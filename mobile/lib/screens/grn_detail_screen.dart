import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class GrnDetailScreen extends StatefulWidget {
  final Map<String, dynamic> purchaseOrder;
  const GrnDetailScreen({super.key, required this.purchaseOrder});

  @override
  State<GrnDetailScreen> createState() => _GrnDetailScreenState();
}

class _GrnDetailScreenState extends State<GrnDetailScreen> {
  late final List<dynamic> _lines;
  final Map<String, TextEditingController> _qtyControllers = {};
  final Map<String, TextEditingController> _expiryControllers = {};
  final _notesCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _lines = (widget.purchaseOrder['lines'] as List?) ?? [];
    for (final line in _lines) {
      final id = line['id'] as String;
      _qtyControllers[id] = TextEditingController(
          text: (line['qty_ordered'] as num).toString());
      _expiryControllers[id] = TextEditingController();
    }
  }

  @override
  void dispose() {
    for (final c in _qtyControllers.values) {
      c.dispose();
    }
    for (final c in _expiryControllers.values) {
      c.dispose();
    }
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(String lineId) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 30)),
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (picked != null) {
      _expiryControllers[lineId]!.text =
          DateFormat('yyyy-MM-dd').format(picked);
    }
  }

  Future<void> _submit() async {
    for (final line in _lines) {
      final id = line['id'] as String;
      if (_expiryControllers[id]!.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Expiry date is required for all lines.')));
        return;
      }
    }

    setState(() => _submitting = true);
    try {
      final dio = await ApiService.get();
      final poId = widget.purchaseOrder['id'] as String;
      await dio.post('/api/v1/purchase-orders/$poId/receive', data: {
        'lines': _lines.map((line) {
          final id = line['id'] as String;
          return {
            'po_line_id': id,
            'qty_received': int.tryParse(_qtyControllers[id]!.text) ?? 0,
            'expiry_date': _expiryControllers[id]!.text,
          };
        }).toList(),
        if (_notesCtrl.text.isNotEmpty) 'notes': _notesCtrl.text,
      });
      if (mounted) {
        final poId = widget.purchaseOrder['id'] as String;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('GRN created for $poId.')));
        Navigator.pop(context);
      }
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error']?['message']?.toString()
          ?? 'Receive failed';
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final po = widget.purchaseOrder;
    final poId = po['id'] as String? ?? '';
    final supplier = po['supplier_name'] as String?
        ?? po['supplier_id'] as String?
        ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(poId),
            Text(supplier,
                style: const TextStyle(
                    fontSize: 11, color: Color(0xFF7C3AED))),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ..._lines.map((line) {
                  final id = line['id'] as String;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            line['sku_name'] as String?
                                ?? line['sku_id'] as String,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _qtyControllers[id],
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText:
                                  'Qty received (ordered: ${line['qty_ordered']})',
                              border: const OutlineInputBorder(),
                              isDense: true,
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: _expiryControllers[id],
                            readOnly: true,
                            decoration: const InputDecoration(
                              labelText: 'Expiry date *',
                              border: OutlineInputBorder(),
                              isDense: true,
                              suffixIcon:
                                  Icon(Icons.calendar_today, size: 18),
                            ),
                            onTap: () => _pickDate(id),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 8),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Notes (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton.icon(
              icon: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check_circle_outline),
              label: const Text('Submit GRN'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                backgroundColor: const Color(0xFF7C3AED),
              ),
              onPressed: _submitting ? null : _submit,
            ),
          ),
        ],
      ),
    );
  }
}
