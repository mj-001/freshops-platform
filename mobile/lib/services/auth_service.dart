import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'freshops_token';
  static const _userKey = 'freshops_user_id';
  static const _roleKey = 'freshops_user_role';
  static const _nameKey = 'freshops_user_name';
  static const _mustResetKey = 'freshops_must_reset';

  static Future<void> saveSession({
    required String token,
    required String userId,
    required String role,
    required String name,
    required bool mustReset,
  }) async {
    await Future.wait([
      _storage.write(key: _tokenKey, value: token),
      _storage.write(key: _userKey, value: userId),
      _storage.write(key: _roleKey, value: role),
      _storage.write(key: _nameKey, value: name),
      _storage.write(key: _mustResetKey, value: mustReset.toString()),
    ]);
  }

  static Future<void> clearSession() async {
    await _storage.deleteAll();
  }

  static Future<String?> getToken() => _storage.read(key: _tokenKey);
  static Future<String?> getUserId() => _storage.read(key: _userKey);
  static Future<String?> getRole() => _storage.read(key: _roleKey);
  static Future<String?> getName() => _storage.read(key: _nameKey);
  static Future<bool> getMustReset() async {
    final v = await _storage.read(key: _mustResetKey);
    return v == 'true';
  }

  static Future<bool> hasSession() async {
    final token = await _storage.read(key: _tokenKey);
    return token != null;
  }
}
