import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/reset_password_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final auth = AuthProvider();
  await auth.loadStoredSession();
  runApp(
    ChangeNotifierProvider.value(
      value: auth,
      child: const FreshOpsApp(),
    ),
  );
}

class FreshOpsApp extends StatelessWidget {
  const FreshOpsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FreshOps',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0D9488),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          if (!auth.isLoggedIn) return const LoginScreen();
          if (auth.mustResetPassword) return const ResetPasswordScreen();
          return const HomeScreen();
        },
      ),
    );
  }
}
