import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    if (_newCtrl.text != _confirmCtrl.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }
    if (_newCtrl.text.length < 8) {
      setState(() => _error = 'Password must be at least 8 characters.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthProvider>();
      final dio = await ApiService.get();
      await dio.post('/api/v1/auth/reset-password', data: {
        'user_id': auth.userId,
        'current_password': _currentCtrl.text,
        'new_password': _newCtrl.text,
      });
      if (!mounted) return;
      await auth.clearMustReset();
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error']?['message']
          ?? e.message
          ?? 'Request failed';
      setState(() => _error = msg as String?);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Set New Password')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Your password must be changed before you can continue.',
                style: TextStyle(color: Colors.amber),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _currentCtrl,
                obscureText: true,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Current password',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _newCtrl,
                obscureText: true,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'New password',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _confirmCtrl,
                obscureText: true,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
                decoration: const InputDecoration(
                  labelText: 'Confirm new password',
                  border: OutlineInputBorder(),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.redAccent)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _submit,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: _loading
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Update Password'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
