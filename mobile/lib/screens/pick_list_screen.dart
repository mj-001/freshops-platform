import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../services/api_service.dart';
import '../services/cache_service.dart';
import 'pick_list_detail_screen.dart';

class PickListScreen extends StatefulWidget {
  const PickListScreen({super.key});

  @override
  State<PickListScreen> createState() => _PickListScreenState();
}

class _PickListScreenState extends State<PickListScreen> {
  List<dynamic> _lists = [];
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
      final res = await dio.get('/api/v1/pick-lists');
      final data = (res.data['data'] as List);
      await CacheService.put('pick_lists', data);
      setState(() { _lists = data; _loading = false; });
    } on DioException catch (_) {
      final cached = await CacheService.get<List>('pick_lists');
      setState(() {
        _lists = cached ?? [];
        _loading = false;
        _error = cached != null ? 'Offline — showing cached data' : 'Failed to load';
      });
    }
  }

  Color _statusColor(String status) => switch (status) {
        'pending' => Colors.grey,
        'in_progress' => Colors.amber,
        'completed' => Colors.green,
        _ => Colors.grey,
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pick Lists'),
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
                    color: Colors.amber.withOpacity(0.2),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(children: [
                      const Icon(Icons.warning_amber, size: 16),
                      const SizedBox(width: 8),
                      Text(_error!, style: const TextStyle(fontSize: 12)),
                    ]),
                  ),
                Expanded(
                  child: _lists.isEmpty
                      ? const Center(child: Text('No pick lists found.'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            itemCount: _lists.length,
                            itemBuilder: (context, i) {
                              final pl = _lists[i] as Map<String, dynamic>;
                              final lines = (pl['lines'] as List?) ?? [];
                              final done = lines.where((l) => l['status'] != 'pending').length;
                              return ListTile(
                                leading: CircleAvatar(
                                  backgroundColor:
                                      _statusColor(pl['status'] ?? '').withOpacity(0.2),
                                  child: Icon(Icons.checklist,
                                      color: _statusColor(pl['status'] ?? '')),
                                ),
                                title: Text(pl['id'] as String? ?? ''),
                                subtitle: Text(
                                    '${pl['status']} · $done/${lines.length} lines'),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => PickListDetailScreen(
                                        pickListId: pl['id'] as String),
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
