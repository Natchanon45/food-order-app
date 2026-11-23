import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lk_shop/main.dart';
import 'package:lk_shop/src/lk_shop_ui.dart';

void main() {
  testWidgets('LK Shop shell shows app title', (tester) async {
    // The native secure-store workflow is tested on devices. Ensure
    // both platform bundles share the same top-level Flutter app.
    await tester.pumpWidget(const LKShopApp(firebaseReady: false));
    expect(find.text('LK Shop'), findsOneWidget);
    final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(app.theme?.textTheme.bodyMedium?.fontFamily, 'Kanit');
    expect(roleNames['superadmin_slip_manual'], 'แจ้งเตือนส่วนกลาง');
    expect(roleNames['admin_store'], 'แอดมินร้าน');
    expect(roleNames['cashier_delivery'], 'แคชเชียร์');
    expect(roleNames['kitchen_delivery'], 'ครัว');
  });
  testWidgets('version footer remains visible on every Navigator route', (
    tester,
  ) async {
    await tester.pumpWidget(const LKShopApp(firebaseReady: false));
    expect(find.byType(LKAppVersionFooter), findsOneWidget);
    expect(find.byType(LKVersionFooter), findsOneWidget);

    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.push(
      MaterialPageRoute<void>(
        builder: (context) =>
            const Scaffold(body: Center(child: Text('หน้ารายละเอียด'))),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('หน้ารายละเอียด'), findsOneWidget);
    expect(find.byType(LKVersionFooter), findsOneWidget);
  });
}
