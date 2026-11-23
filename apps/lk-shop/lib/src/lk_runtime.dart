/// PENGUIN LK Shop native runtime contract. The old LUKKAJA origin is
/// deliberately not an option, including for QR manual fallback and links.
class LKRuntime {
  LKRuntime._();
  static const origin = 'https://penguin-food.web.app';
  static const allowedDebugHosts = {'127.0.0.1', 'localhost', '10.0.2.2'};
  static const firebaseProjectId = 'chat-45754';

  /// No FCM initialization until a *separate native PENGUIN Firebase app*
  /// has been registered for the exact Android/iOS bundle identifier.
  /// The following four public values are injected by build automation,
  /// not checked into version control.
  static const apiKey = String.fromEnvironment('LK_FIREBASE_API_KEY');
  static const appId = String.fromEnvironment('LK_FIREBASE_APP_ID');
  static const senderId = String.fromEnvironment('LK_FIREBASE_SENDER_ID');
  static const projectId = String.fromEnvironment('LK_FIREBASE_PROJECT_ID');

  static bool get nativeFirebaseConfigured =>
      apiKey.isNotEmpty &&
      appId.isNotEmpty &&
      senderId.isNotEmpty &&
      projectId == firebaseProjectId;

  /// Only app-created HTTPS links on the exact Firebase Hosting origin.
  /// Role cannot be chosen via a user-controlled link.
  static bool allowedTarget(String raw, String role) {
    final uri = Uri.tryParse(raw);
    // Uri normalizes dot segments, so reject them from the raw link first.
    // Encoded path separators / dots must not bypass exact role paths.
    if (RegExp(r'\.\.|%2e|%2f|%5c', caseSensitive: false).hasMatch(raw) ||
        uri == null ||
        uri.scheme != 'https' ||
        uri.host != 'penguin-food.web.app' ||
        uri.hasPort ||
        uri.userInfo.isNotEmpty ||
        uri.hasFragment ||
        uri.pathSegments.isEmpty) {
      return false;
    }
    final expectedPath = switch (role) {
      'superadmin_slip_manual' => '/admin/tenants',
      'admin_store' => '/admin',
      'cashier_delivery' => '/cashier',
      'kitchen_delivery' => '/kitchen',
      _ => '',
    };
    return expectedPath.isNotEmpty &&
        uri.path == expectedPath &&
        uri.queryParameters.isEmpty;
  }
}
