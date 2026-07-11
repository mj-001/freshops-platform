import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';
import '../services/cache_service.dart';
import 'grn_detail_screen.dart';

class GrnScreen extends StatefulWidget {
  const GrnScreen({super.key});

  @override
  State<GrnScreen> createState() => _GrnScreenState();
}

class _GrnScreenState extends State<GrnScreen> {
  List<dynamic> _pos = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = await ApiService.get();
      final res = await dio.get('/api/v1/purchase-orders',
          queryParameters: {'status': 'sent'});
      final data = (res.data['data'] as List);
      await CacheService.put('pending_pos', data);
      setState(() { _pos = data; _loading = false; });
    } on DioException catch (_) {
      final cached = await CacheService.get<List>('pending_pos');
      setState(() {
        _pos = cached ?? [];
        _loading = false;
        _error = cached != null ? 'Offline — showing cached data' : 'Failed to load';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Receive (GRN)'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_error != null)
                  Container(
                    color: Colors.amber.withValues(alpha: 0.2),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(children: [
                      const Icon(Icons.warning_amber, size: 16),
                      const SizedBox(width: 8),
                      Text(_error!, style: const TextStyle(fontSize: 12)),
                    ]),
                  ),
                Expanded(
                  child: _pos.isEmpty
                      ? const Center(child: Text('No pending purchase orders.'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            itemCount: _pos.length,
                            itemBuilder: (context, i) {
                              final po = _pos[i] as Map<String, dynamic>;
                              final lines = (po['lines'] as List?) ?? [];
                              return ListTile(
                                leading: const CircleAvatar(
                                  backgroundColor: Color(0x267C3AED),
                                  child: Icon(Icons.move_to_inbox_outlined,
                                      color: Color(0xFF7C3AED)),
                                ),
                                title: Text(po['id'] as String? ?? ''),
                                subtitle: Text(
                                  '${po['supplier_name'] ?? po['supplier_id'] ?? ''}  '
                                  '· ${lines.length} lines',
                                ),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => GrnDetailScreen(
                                        purchaseOrder: po),
                                  ),
                                ).then((_) => _load()),
                              );
                            },
                          ),
                        ),
                ),
              ],
            ),
    );
  }
}
