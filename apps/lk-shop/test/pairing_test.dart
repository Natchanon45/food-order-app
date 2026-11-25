import 'package:flutter_test/flutter_test.dart';
import 'package:lk_shop/src/pairing.dart';

void main() {
  test('manual pairing uses one-time production challenge and refuses invalid codes', () {
    final code = 'a' * 64;
    final valid = LKPairing.fromManualCode(' $code ');
    expect(valid?.code, code);
    expect(valid?.server, 'https://penguin-food.web.app');
    expect(LKPairing.fromManualCode('x' * 64), isNull);
    expect(LKPairing.fromManualCode('A' * 64), isNull);
    expect(LKPairing.fromManualCode('a' * 63), isNull);
    expect(LKPairing.fromManualCode('http://127.0.0.1:8000'), isNull);
  });

  final code = 'a' * 64;
  final qr =
      'lkshop://pair?v=1&server=https%3A%2F%2Fpenguin-food.web.app&code=$code';
  test('accepts only PG Notify short-lived QR format', () {
    final parsed = LKPairing.parse(qr);
    expect(parsed, isNotNull);
    expect(parsed!.server, 'https://penguin-food.web.app');
    expect(parsed.code, code);
  });
  test('rejects insecure, redirecting or malformed QR', () {
    for (final value in [
      'https://penguin-food.web.app/?code=$code',
      qr.replaceFirst(
        'penguin-food.web.app',
        'penguin-food.web.app.evil.example',
      ),
      qr.replaceFirst('https%3A', 'http%3A'),
      qr.replaceFirst('v=1', 'v=2'),
      '$qr&code=$code',
      '$qr#injected',
      qr.replaceFirst(code, 'invalid'),
    ]) {
      expect(LKPairing.parse(value), isNull, reason: value);
    }
  });
  test('loopback can only be used for debugging', () {
    final local =
        'lkshop://pair?v=1&server=http%3A%2F%2F127.0.0.1%3A5000&code=$code';
    expect(LKPairing.parse(local), isNull);
    expect(LKPairing.parse(local, allowLocal: true), isNotNull);
  });
}
