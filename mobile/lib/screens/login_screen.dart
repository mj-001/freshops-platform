import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = Dio(BaseOptions(
        baseUrl: 'https://freshops-wms-499852198599.europe-west1.run.app',
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
      ));
      final res = await dio.post('/api/v1/auth/login', data: {
        'email': _emailCtrl.text.trim(),
        'password': _passCtrl.text,
      });
      final body = res.data as Map<String, dynamic>;
      if (!mounted) return;
      await context.read<AuthProvider>().login(
        token: body['token'] as String,
        user: body['user'] as Map<String, dynamic>,
        mustResetPassword: body['must_reset_password'] == true,
      );
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error']?['message']
          ?? e.message
          ?? 'Network error';
      setState(() => _error = msg as String?);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.warehouse, size: 64, color: Color(0xFF0D9488)),
                const SizedBox(height: 16),
                Text(
                  'FreshOps',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: const Color(0xFF0D9488),
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email_outlined),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passCtrl,
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _login(),
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    prefixIcon: Icon(Icons.lock_outlined),
                    border: OutlineInputBorder(),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _loading ? null : _login,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                  child: _loading
                      ? const SizedBox(height: 20, width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
