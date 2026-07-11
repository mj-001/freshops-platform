import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/api_service.dart';

class PickListDetailScreen extends StatefulWidget {
  final String pickListId;
  const PickListDetailScreen({super.key, required this.pickListId});

  @override
  State<PickListDetailScreen> createState() => _PickListDetailScreenState();
}

class _PickListDetailScreenState extends State<PickListDetailScreen> {
  Map<String, dynamic>? _pickList;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  final Map<String, TextEditingController> _qtyControllers = {};
  final Map<String, String?> _shortReasons = {};

  static const _shortReasonOptions = [
    'OUT_OF_STOCK',
    'DAMAGED_ON_SHELF',
    'LOCATION_EMPTY',
    'EXPIRY_ISSUE',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _qtyControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = await ApiService.get();
      final res = await dio.get('/api/v1/pick-lists/${widget.pickListId}');
      final pl = res.data['data'] as Map<String, dynamic>;
      final lines = (pl['lines'] as List?) ?? [];
      for (final line in lines) {
        final id = line['id'] as String;
        _qtyControllers.putIfAbsent(
          id,
          () => TextEditingController(
              text: (line['qty_picked'] ?? line['qty_requested']).toString()),
        );
      }
      setState(() { _pickList = pl; _loading = false; });
    } on DioException catch (e) {
      setState(() {
        _loading = false;
        _error = (e.response?.data as Map?)?['error']?['message']?.toString()
            ?? 'Failed to load';
      });
    }
  }

  Future<void> _saveLine(String lineId, int qtyRequested) async {
    final qty = int.tryParse(_qtyControllers[lineId]?.text ?? '') ?? 0;
    final isShort = qty < qtyRequested;
    if (isShort && _shortReasons[lineId] == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Select a short-pick reason first.')));
      return;
    }
    try {
      final dio = await ApiService.get();
      await dio.patch(
        '/api/v1/pick-lists/${widget.pickListId}/lines/$lineId',
        data: {
          'qty_picked': qty,
          if (isShort) 'short_pick_reason': _shortReasons[lineId],
        },
      );
      await _load();
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error']?['message']?.toString()
          ?? 'Save failed';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  Future<void> _complete() async {
    setState(() => _submitting = true);
    try {
      final dio = await ApiService.get();
      await dio.post('/api/v1/pick-lists/${widget.pickListId}/complete');
      if (mounted) Navigator.pop(context);
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error']?['message']?.toString()
          ?? 'Failed to complete';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _scanBarcode(String lineId) async {
    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const _ScannerPage()),
    );
    if (result != null && _qtyControllers.containsKey(lineId)) {
      final current = int.tryParse(_qtyControllers[lineId]!.text) ?? 0;
      _qtyControllers[lineId]!.text = (current + 1).toString();
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null) {
      return Scaffold(appBar: AppBar(), body: Center(child: Text(_error!)));
    }

    final pl = _pickList!;
    final lines = (pl['lines'] as List?) ?? [];
    final status = pl['status'] as String? ?? '';
    final isLocked = status == 'completed';
    final allActioned = lines.every((l) => (l as Map)['status'] != 'pending');

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(pl['id'] as String? ?? 'Pick List'),
            Text(status.toUpperCase(),
                style: const TextStyle(fontSize: 11, color: Color(0xFF0D9488))),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: lines.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) => _buildLine(
                  context, lines[i] as Map<String, dynamic>, isLocked),
            ),
          ),
          if (!isLocked)
            Padding(
              padding: const EdgeInsets.all(16),
              child: FilledButton.icon(
                icon: _submitting
                    ? const SizedBox(width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.check_circle_outline),
                label: const Text('Complete Pick List'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  backgroundColor:
                      allActioned ? const Color(0xFF0D9488) : Colors.grey,
                ),
                onPressed: (!allActioned || _submitting) ? null : _complete,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildLine(
      BuildContext context, Map<String, dynamic> line, bool isLocked) {
    final lineId = line['id'] as String;
    final qtyReq = (line['qty_requested'] as num).toInt();
    final lineStatus = line['status'] as String? ?? 'pending';
    final isDone = lineStatus != 'pending';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Text(
                line['sku_name'] as String? ?? line['sku_id'] as String,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            _statusChip(lineStatus),
          ]),
          const SizedBox(height: 4),
          Text(
            'Loc: ${line['location_code'] ?? '—'}  '
            'Batch: ${line['batch_number'] ?? line['batch_id'] ?? '—'}  '
            'Exp: ${line['expiry_date'] ?? '—'}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          Row(children: [
            Text('Req: $qtyReq   Picked: '),
            SizedBox(
              width: 64,
              child: TextField(
                controller: _qtyControllers[lineId],
                enabled: !isLocked && !isDone,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  isDense: true,
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(width: 8),
            if (!isLocked && !isDone)
              IconButton(
                icon: const Icon(Icons.qr_code_scanner, size: 20),
                tooltip: 'Scan barcode',
                onPressed: () => _scanBarcode(lineId),
              ),
          ]),
          if (!isLocked && !isDone)
            _shortPickRow(lineId, qtyReq),
          if (!isLocked && !isDone) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.tonal(
                style: FilledButton.styleFrom(
                  minimumSize: const Size(80, 36),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                onPressed: () => _saveLine(lineId, qtyReq),
                child: const Text('Confirm'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _shortPickRow(String lineId, int qtyReq) {
    final qty = int.tryParse(_qtyControllers[lineId]?.text ?? '') ?? 0;
    if (qty >= qtyReq) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: DropdownButtonFormField<String>(
        initialValue: _shortReasons[lineId],
        hint: const Text('Short-pick reason *',
            style: TextStyle(fontSize: 13)),
        decoration: const InputDecoration(
          isDense: true,
          border: OutlineInputBorder(),
          contentPadding:
              EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        ),
        items: _shortReasonOptions
            .map((r) => DropdownMenuItem(
                value: r,
                child: Text(r, style: const TextStyle(fontSize: 13))))
            .toList(),
        onChanged: (v) => setState(() => _shortReasons[lineId] = v),
      ),
    );
  }

  Widget _statusChip(String status) {
    final color = switch (status) {
      'picked' => Colors.green,
      'short_picked' => Colors.orange,
      _ => Colors.grey,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(status, style: TextStyle(fontSize: 11, color: color)),
    );
  }
}

class _ScannerPage extends StatefulWidget {
  const _ScannerPage();

  @override
  State<_ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<_ScannerPage> {
  bool _scanned = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan Barcode')),
      body: MobileScanner(
        onDetect: (capture) {
          if (_scanned) return;
          final code = capture.barcodes.firstOrNull?.rawValue;
          if (code != null) {
            _scanned = true;
            Navigator.pop(context, code);
          }
        },
      ),
    );
  }
}
