import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'lk_runtime.dart';

class LKApiException implements Exception {
  const LKApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class LKMessage {
  LKMessage({
    required this.id,
    required this.body,
    required this.target,
    required this.createdUTC,
  });
  final int id;
  final String body;
  final String target;
  final DateTime createdUTC;
  factory LKMessage.fromJson(Map<String, dynamic> d) => LKMessage(
    id: (d['id'] as num).toInt(),
    body: d['body'] as String? ?? '',
    target: d['target'] as String? ?? '',
    createdUTC:
        DateTime.tryParse(d['createdUTC'] as String? ?? '') ?? DateTime.now(),
  );
}

class LKConnection {
  const LKConnection({
    required this.server,
    required this.credential,
    required this.deviceId,
    required this.role,
  });
  final String server, credential, deviceId, role;
}

class LKApi {
  LKApi({http.Client? client, FlutterSecureStorage? storage})
    : _http = client ?? http.Client(),
      _storage = storage ?? const FlutterSecureStorage();
  final http.Client _http;
  final FlutterSecureStorage _storage;
  static const key = 'penguin_lk_shop_pair_v1';
  LKConnection? current;
  Future<void> restore() async {
    try {
      final raw = await _storage.read(key: key);
      if (raw == null) return;
      final d = jsonDecode(raw) as Map<String, dynamic>;
      final server = d['server'] as String? ?? '';
      final credential = d['credential'] as String? ?? '';
      final deviceId = d['deviceId'] as String? ?? '';
      final role = d['role'] as String? ?? '';
      if (server != LKRuntime.origin ||
          !RegExp(r'^[a-f0-9]{64}$').hasMatch(credential) ||
          !RegExp(r'^[A-Za-z0-9_-]{4,128}$').hasMatch(deviceId) ||
          !const {
            'superadmin_slip_manual',
            'admin_store',
            'cashier_delivery',
            'kitchen_delivery',
          }.contains(role)) {
        await _storage.delete(key: key);
        current = null;
        return;
      }
      current = LKConnection(
        server: server,
        credential: credential,
        deviceId: deviceId,
        role: role,
      );
    } catch (_) {
      current = null;
    }
  }

  Future<Map<String, dynamic>> _call(
    String server,
    String path, {
    Object? body,
    String? credential,
    String method = 'GET',
  }) async {
    if (server != LKRuntime.origin &&
        !(const bool.fromEnvironment('dart.vm.product') == false &&
            (Uri.tryParse(server)?.scheme == 'http') &&
            LKRuntime.allowedDebugHosts.contains(
              Uri.tryParse(server)?.host ?? '',
            ) &&
            const [5000, 5001].contains(Uri.tryParse(server)?.port))) {
      throw const LKApiException(
        'ไม่อนุญาตให้ใช้เซิร์ฟเวอร์อื่นกับ PG Notify PENGUIN',
      );
    }
    final url = Uri.parse(server + path);
    final request = http.Request(method, url);
    // Do not forward a device bearer to a redirecting host, including 307
    // or 308 which preserve Authorization and the original HTTP method.
    request.followRedirects = false;
    request.maxRedirects = 0;
    request.headers['Accept'] = 'application/json';
    if (credential != null) {
      request.headers['Authorization'] = 'Bearer $credential';
    }
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    http.Response res;
    try {
      res = await _http
          .send(request)
          .then(http.Response.fromStream)
          .timeout(const Duration(seconds: 12));
    } catch (_) {
      throw const LKApiException('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
    Map<String, dynamic> payload;
    try {
      payload = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      throw const LKApiException('เซิร์ฟเวอร์ส่งข้อมูลไม่ถูกต้อง');
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      if (res.statusCode == 410) {
        throw const LKApiException('QR หมดอายุหรือใช้งานแล้ว กรุณาขอ QR ใหม่');
      }
      if (res.statusCode == 401) {
        throw const LKApiException('อุปกรณ์นี้ถูกยกเลิกสิทธิ์แล้ว');
      }
      throw LKApiException(
        'คำขอไม่สำเร็จ (${payload['error']?.toString() ?? res.statusCode.toString()})',
      );
    }
    return payload;
  }

  Future<LKConnection> enroll(
    String server,
    String code,
    String fcmToken,
    String name,
  ) async {
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(code) ||
        !RegExp(
          r'^[\p{L}\p{M}\p{N} ._()-]{1,100}$',
          unicode: true,
        ).hasMatch(name.trim())) {
      throw const LKApiException('ชื่ออุปกรณ์หรือรหัสจับคู่ไม่ถูกต้อง');
    }
    final data = await _call(
      server,
      '/api/lk-shop/enroll',
      method: 'POST',
      body: {
        'code': code,
        'platform': Platform.isIOS ? 'ios' : 'android',
        'name': name,
        'fcmToken': fcmToken,
      },
    );
    final credential = data['credential'] as String? ?? '';
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(credential)) {
      throw const LKApiException('ไม่ได้รับรหัสเชื่อมต่อที่ถูกต้อง');
    }
    final role = data['role'] as String? ?? '';
    final deviceId = data['deviceId'] as String? ?? '';
    if (!const {
          'superadmin_slip_manual',
          'admin_store',
          'cashier_delivery',
          'kitchen_delivery',
        }.contains(role) ||
        !RegExp(r'^[A-Za-z0-9_-]{4,128}$').hasMatch(deviceId) ||
        !const {'tenant', 'platform'}.contains(data['scope']) ||
        (role == 'superadmin_slip_manual') != (data['scope'] == 'platform')) {
      throw const LKApiException('เซิร์ฟเวอร์ส่งห้องหรืออุปกรณ์ไม่ถูกต้อง');
    }
    final c = LKConnection(
      server: server,
      credential: credential,
      deviceId: deviceId,
      role: role,
    );
    await _storage.write(
      key: key,
      value: jsonEncode({
        'server': c.server,
        'credential': c.credential,
        'deviceId': c.deviceId,
        'role': c.role,
      }),
    );
    current = c;
    return c;
  }

  Future<Map<String, dynamic>> status() async {
    final c = current;
    if (c == null) throw const LKApiException('ยังไม่ได้จับคู่อุปกรณ์');
    return _call(c.server, '/api/lk-shop/device', credential: c.credential);
  }

  Future<List<LKMessage>> inbox() async {
    final c = current;
    if (c == null) return [];
    final d = await _call(
      c.server,
      '/api/lk-shop/inbox',
      credential: c.credential,
    );
    return ((d['notifications'] as List<dynamic>?) ?? [])
        .map((v) => LKMessage.fromJson(v as Map<String, dynamic>))
        .toList();
  }

  Future<void> updatePushToken(String token) async {
    final c = current;
    if (c == null) return;
    await _call(
      c.server,
      '/api/lk-shop/device/push-token',
      credential: c.credential,
      method: 'PUT',
      body: {'fcmToken': token},
    );
  }

  Future<void> unpair() async {
    final c = current;
    if (c == null) return;
    await _call(
      c.server,
      '/api/lk-shop/device/unpair',
      credential: c.credential,
      method: 'POST',
      body: {},
    );
    await _storage.delete(key: key);
    current = null;
  }

  Future<void> forgetRevoked() async {
    await _storage.delete(key: key);
    current = null;
  }
}
