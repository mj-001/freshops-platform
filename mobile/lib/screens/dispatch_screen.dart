import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';
import '../services/cache_service.dart';

class DispatchScreen extends StatefulWidget {
  const DispatchScreen({super.key});

  @override
  State<DispatchScreen> createState() => _DispatchScreenState();
}

class _DispatchScreenState extends State<DispatchScreen> {
  List<dynamic> _orders = [];
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
      final res = await dio.get('/api/v1/orders', queryParameters: {'status': 'packed'});
      final data = (res.data['data'] as List);
      await CacheService.put('dispatch_orders', data);
      setState(() { _orders = data; _loading = false; });
    } on DioException catch (_) {
      final cached = await CacheService.get<List>('dispatch_orders');
      setState(() {
        _orders = cached ?? [];
        _loading = false;
        _error = cached != null ? 'Offline — showing cached data' : 'Failed to load';
      });
    }
  }

  Future<Position?> _getGps() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        final req = await Geolocator.requestPermission();
        if (req == LocationPermission.denied ||
            req == LocationPermission.deniedForever) return null;
      }
      return await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)));
    } catch (_) {
      return null;
    }
  }

  Future<void> _dispatch(Map<String, dynamic> order) async {
    final orderId = order['id'] as String;

    final toteCtrl = TextEditingController();
    final tempCtrl = TextEditingController();
    final hasCold = (order['has_cold_chain_items'] as bool?) ?? false;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24, right: 24, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Dispatch ${orderId}',
                style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 16),
            TextField(
              controller: toteCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Tote count',
                border: OutlineInputBorder(),
              ),
            ),
            if (hasCold) ...[
              const SizedBox(height: 12),
              TextField(
                controller: tempCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                decoration: const InputDecoration(
                  labelText: 'Dispatch temperature (°C) *',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Confirm & Dispatch'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Getting GPS location...')));

    final pos = await _getGps();

    try {
      final dio = await ApiService.get();
      await dio.post('/api/v1/orders/$orderId/dispatch', data: {
        if (toteCtrl.text.isNotEmpty) 'tote_count': int.tryParse(toteCtrl.text),
        if (pos != null) 'gps_lat': pos.latitude,
        if (pos != null) 'gps_lng': pos.longitude,
        if (hasCold && tempCtrl.text.isNotEmpty)
          'temp_log': {
            'temperature_celsius': double.tryParse(tempCtrl.text),
          },
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$orderId dispatched.')));
        _load();
      }
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error']?['message']?.toString()
          ?? 'Dispatch failed';
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dispatch'),
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
                  child: _orders.isEmpty
                      ? const Center(child: Text('No packed orders ready to dispatch.'))
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            itemCount: _orders.length,
                            itemBuilder: (context, i) {
                              final o = _orders[i] as Map<String, dynamic>;
                              return ListTile(
                                leading: const CircleAvatar(
                                  backgroundColor: Color(0x260891B2),
                                  child: Icon(Icons.local_shipping_outlined,
                                      color: Color(0xFF0891B2)),
                                ),
                                title: Text(o['id'] as String? ?? ''),
                                subtitle: Text(
                                  '${o['customer_name'] ?? o['customer_id'] ?? ''}  '
                                  '· ${o['lines']?.length ?? 0} lines',
                                ),
                                trailing: FilledButton(
                                  style: FilledButton.styleFrom(
                                    minimumSize: const Size(80, 36),
                                    backgroundColor: const Color(0xFF0891B2),
                                  ),
                                  onPressed: () => _dispatch(o),
                                  child: const Text('Dispatch'),
                                ),
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
