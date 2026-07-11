import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class CacheService {
  static Database? _db;

  static Future<Database> get db async {
    _db ??= await _open();
    return _db!;
  }

  static Future<Database> _open() async {
    final path = join(await getDatabasesPath(), 'freshops_cache.db');
    return openDatabase(path, version: 1, onCreate: (db, version) async {
      await db.execute('''
        CREATE TABLE cache (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      ''');
    });
  }

  static Future<void> put(String key, dynamic value) async {
    final database = await db;
    await database.insert('cache', {
      'key': key,
      'value': jsonEncode(value),
      'updated_at': DateTime.now().millisecondsSinceEpoch,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  static Future<T?> get<T>(String key) async {
    final database = await db;
    final rows = await database.query('cache', where: 'key = ?', whereArgs: [key]);
    if (rows.isEmpty) return null;
    return jsonDecode(rows.first['value'] as String) as T?;
  }

  static Future<void> clear() async {
    final database = await db;
    await database.delete('cache');
  }
}
