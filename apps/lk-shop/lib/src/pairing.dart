import 'package:flutter/foundation.dart';

import 'lk_runtime.dart';

@immutable
class LKPairing {
  const LKPairing({required this.server, required this.code});
  final String server;
  final String code;

  /// Manual fallback for emulators without a real camera. Uses the exact same
  /// enrolment endpoint and one-use challenge; never accepts an arbitrary host.
  static LKPairing? fromManualCode(String raw) {
    final code = raw.trim();
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(code)) return null;
    return LKPairing.parse(
      'lkshop://pair?v=1&server=https%3A%2F%2Fpenguin-food.web.app&code=$code',
    );
  }

  static LKPairing? parse(String? raw, {bool allowLocal = false}) {
    if (raw == null || raw.length > 700) return null;
    final qr = Uri.tryParse(raw);
    if (qr == null ||
        qr.scheme != 'lkshop' ||
        qr.host != 'pair' ||
        qr.path.isNotEmpty ||
        qr.hasFragment ||
        qr.queryParameters.length != 3 ||
        qr.queryParametersAll.values.any((values) => values.length != 1) ||
        qr.queryParameters['v'] != '1') {
      return null;
    }
    final server = Uri.tryParse(qr.queryParameters['server'] ?? '');
    final code = qr.queryParameters['code'] ?? '';
    if (server == null ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(code) ||
        server.userInfo.isNotEmpty ||
        server.hasQuery ||
        server.hasFragment ||
        (server.path.isNotEmpty && server.path != '/') ||
        (server.host != 'penguin-food.web.app' &&
            !(allowLocal &&
                LKRuntime.allowedDebugHosts.contains(server.host))) ||
        (server.scheme != 'https' &&
            !(allowLocal && server.scheme == 'http'))) {
      return null;
    }
    return LKPairing(
      server: server.replace(path: '').toString(),
      code: code,
    );
  }
}
