import 'package:dio/dio.dart';
import 'auth_service.dart';

class ApiService {
  static const _base = 'https://freshops-wms-499852198599.europe-west1.run.app';

  static Future<Dio> get() async {
    final token = await AuthService.getToken();
    return Dio(BaseOptions(
      baseUrl: _base,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    ));
  }

  static Dio withToken(String token) => Dio(BaseOptions(
        baseUrl: _base,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ));
}
