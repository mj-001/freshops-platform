import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  bool _isLoggedIn = false;
  bool _mustResetPassword = false;
  String? _token;
  String? _userId;
  String? _role;
  String? _name;

  bool get isLoggedIn => _isLoggedIn;
  bool get mustResetPassword => _mustResetPassword;
  String? get token => _token;
  String? get userId => _userId;
  String? get role => _role;
  String? get name => _name;

  Future<void> loadStoredSession() async {
    if (!await AuthService.hasSession()) return;
    _token = await AuthService.getToken();
    _userId = await AuthService.getUserId();
    _role = await AuthService.getRole();
    _name = await AuthService.getName();
    _mustResetPassword = await AuthService.getMustReset();
    _isLoggedIn = true;
    notifyListeners();
  }

  Future<void> login({
    required String token,
    required Map<String, dynamic> user,
    required bool mustResetPassword,
  }) async {
    _token = token;
    _userId = user['id'] as String?;
    _role = user['role'] as String?;
    _name = user['name'] as String?;
    _mustResetPassword = mustResetPassword;
    _isLoggedIn = true;

    await AuthService.saveSession(
      token: token,
      userId: _userId ?? '',
      role: _role ?? '',
      name: _name ?? '',
      mustReset: mustResetPassword,
    );
    notifyListeners();
  }

  Future<void> clearMustReset() async {
    _mustResetPassword = false;
    await AuthService.saveSession(
      token: _token ?? '',
      userId: _userId ?? '',
      role: _role ?? '',
      name: _name ?? '',
      mustReset: false,
    );
    notifyListeners();
  }

  Future<void> logout() async {
    _isLoggedIn = false;
    _mustResetPassword = false;
    _token = null;
    _userId = null;
    _role = null;
    _name = null;
    await AuthService.clearSession();
    notifyListeners();
  }
}
