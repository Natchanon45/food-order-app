import 'package:flutter/material.dart';

import 'lk_api.dart';

const lkBrandGreen = Color(0xff087d43);
const lkDarkGreen = Color(0xff06492e);
const lkSoftGreen = Color(0xffe9f7ee);
const lkSoftBlue = Color(0xffedf6fc);
const lkDarkText = Color(0xff163a2a);
const lkShopIcon = 'assets/lk_shop_app_icon_1024.png';

/// The shop icon is an original storefront illustration, not a banking logo.
class LKShopLogo extends StatelessWidget {
  const LKShopLogo({super.key, this.size = 54});
  final double size;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(size * .24),
    child: Image.asset(
      lkShopIcon,
      width: size,
      height: size,
      fit: BoxFit.cover,
      filterQuality: FilterQuality.medium,
      semanticLabel: 'PG Notify',
    ),
  );
}

class LKBuildLabel extends StatelessWidget {
  const LKBuildLabel({
    super.key,
    required this.version,
    required this.buildNumber,
    this.light = false,
  });

  final String version, buildNumber;
  final bool light;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: light ? Colors.white.withValues(alpha: .15) : lkSoftGreen,
      border: Border.all(
        color: light ? Colors.white24 : const Color(0xffcce8d5),
      ),
      borderRadius: BorderRadius.circular(30),
    ),
    child: Text(
      'Version $version  •  Build $buildNumber',
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: light ? Colors.white : lkDarkGreen,
      ),
    ),
  );
}

/// Compact persistent app footer, rendered by the root app shell on every route.
class LKVersionFooter extends StatelessWidget {
  const LKVersionFooter({
    super.key,
    required this.version,
    required this.buildNumber,
  });

  final String version, buildNumber;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xfff4f8f5),
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 12),
        child: Center(
          heightFactor: 1,
          child: Text(
            'PG Notify  •  Version $version  •  Build $buildNumber',
            maxLines: 1,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Color(0xff537465),
              fontSize: 11,
              fontWeight: FontWeight.w600,
              decoration: TextDecoration.none,
            ),
          ),
        ),
      ),
    ),
  );
}

class LKShopLanding extends StatelessWidget {
  const LKShopLanding({
    super.key,
    required this.deviceName,
    required this.busy,
    required this.onNameChanged,
    required this.onScan,
    required this.onManualPair,
  });

  final String deviceName;
  final bool busy;
  final ValueChanged<String> onNameChanged;
  final VoidCallback onScan, onManualPair;

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xff065532), Color(0xff049352), Color(0xff0b6b41)],
      ),
    ),
    child: SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 32, 22, 22),
        children: [
          const Center(child: LKShopLogo(size: 106)),
          const SizedBox(height: 14),
          const Text(
            'PG Notify',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 5),
          const FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.center,
            child: Text(
              'รับแจ้งเตือนคำสั่งซื้อ การชำระเงินและรายการสำคัญ',
              maxLines: 1,
              softWrap: false,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Color(0xffeefdf4),
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 34),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: .12),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 22),
            child: Column(
              children: [
                Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: const Color(0xffeef9f2),
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: const Icon(
                    Icons.qr_code_scanner_rounded,
                    size: 58,
                    color: lkBrandGreen,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'เชื่อมต่ออุปกรณ์\nเพื่อรับการแจ้งเตือน',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: lkDarkText,
                    fontWeight: FontWeight.bold,
                    fontSize: 21,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 19),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: busy ? null : onScan,
                    icon: const Icon(Icons.qr_code_scanner),
                    label: Text(busy ? 'กำลังเชื่อมต่อ…' : 'สแกน QR'),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    key: const Key('lk-shop-manual-pair-button'),
                    onPressed: busy ? null : onManualPair,
                    icon: const Icon(Icons.keyboard_alt_outlined),
                    label: const Text('กรอกรหัสจับคู่แทนการสแกน QR'),
                  ),
                ),
                const SizedBox(height: 10),
                Material(
                  color: Colors.white,
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: const EdgeInsets.only(bottom: 10),
                    title: const Text(
                      'ชื่ออุปกรณ์',
                      style: TextStyle(
                        fontSize: 13,
                        color: lkDarkText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: const Text(
                      'สำหรับแยกอุปกรณ์เมื่อจัดการการเชื่อมต่อ',
                      style: TextStyle(fontSize: 11),
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 10, bottom: 2),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            TextFormField(
                              initialValue: deviceName,
                              onChanged: onNameChanged,
                              maxLength: 100,
                              decoration: InputDecoration(
                                hintText: 'เช่น มือถือแคชเชียร์',
                                isDense: true,
                                contentPadding: const EdgeInsets.fromLTRB(
                                  14,
                                  19,
                                  14,
                                  12,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                            Positioned(
                              top: -9,
                              left: 14,
                              child: ColoredBox(
                                color: Colors.white,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                  ),
                                  child: Text(
                                    'ชื่ออุปกรณ์',
                                    key: const Key('lk-device-name-legend'),
                                    maxLines: 1,
                                    softWrap: false,
                                    style: const TextStyle(
                                      color: lkDarkGreen,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

enum LKMessageType { order, payment, credit, platform, share, generic }

LKMessageType lkMessageType(String body) {
  final value = body.toLowerCase();
  if (value.contains('เติมเครดิต') ||
      value.contains('เครดิตจัดส่ง') ||
      value.contains('lalamove credit')) {
    return LKMessageType.credit;
  }
  if (value.contains('ส่วนแบ่ง')) return LKMessageType.share;
  if (value.contains('ค่าบริการแพลตฟอร์ม') || value.contains('ค่าบริการระบบ')) {
    return LKMessageType.platform;
  }
  if (value.contains('คำสั่งซื้อใหม่') ||
      value.contains('ออเดอร์ใหม่') ||
      value.contains('ส่งครัว') ||
      value.contains('รับออเดอร์')) {
    return LKMessageType.order;
  }
  if (value.contains('ชำระ') ||
      value.contains('สลิป') ||
      value.contains('โอน')) {
    return LKMessageType.payment;
  }
  if (value.contains('ออเดอร์') ||
      value.contains('คำสั่งซื้อ') ||
      value.contains('ครัว')) {
    return LKMessageType.order;
  }
  return LKMessageType.generic;
}

String lkMessageTitle(String body) {
  switch (lkMessageType(body)) {
    case LKMessageType.order:
      return 'คำสั่งซื้อใหม่';
    case LKMessageType.payment:
      return 'รายการชำระเงิน';
    case LKMessageType.credit:
      return 'เครดิตจัดส่ง';
    case LKMessageType.platform:
      return 'ค่าบริการแพลตฟอร์ม';
    case LKMessageType.share:
      return 'สรุปส่วนแบ่งรายวัน';
    case LKMessageType.generic:
      final line = body.split('\n').where((s) => s.trim().isNotEmpty);
      if (line.isEmpty) return 'แจ้งเตือนใหม่';
      return line.first.trim();
  }
}

IconData lkMessageIcon(LKMessageType type) {
  switch (type) {
    case LKMessageType.order:
      return Icons.shopping_cart_rounded;
    case LKMessageType.payment:
      return Icons.credit_card_rounded;
    case LKMessageType.credit:
      return Icons.local_shipping_rounded;
    case LKMessageType.platform:
      return Icons.account_balance_wallet_rounded;
    case LKMessageType.share:
      return Icons.bar_chart_rounded;
    case LKMessageType.generic:
      return Icons.notifications_rounded;
  }
}

Color lkMessageColor(LKMessageType type) {
  switch (type) {
    case LKMessageType.order:
      return const Color(0xffe78b0b);
    case LKMessageType.payment:
      return const Color(0xff0c936c);
    case LKMessageType.credit:
      return const Color(0xffc94444);
    case LKMessageType.platform:
      return const Color(0xffb87917);
    case LKMessageType.share:
      return const Color(0xff7657c9);
    case LKMessageType.generic:
      return lkBrandGreen;
  }
}

// Thailand observes UTC+07:00 all year. Keep server timestamps as UTC and
// display Bangkok time irrespective of Android emulator/device timezone.
DateTime lkBangkokTime(DateTime date) =>
    date.toUtc().add(const Duration(hours: 7));

String lkMessageClock(DateTime date) {
  final bangkok = lkBangkokTime(date);
  return '${bangkok.hour.toString().padLeft(2, '0')}:${bangkok.minute.toString().padLeft(2, '0')}';
}

String lkMessageDateTime(DateTime date) {
  final bangkok = lkBangkokTime(date);
  final day = bangkok.day.toString().padLeft(2, '0');
  final month = bangkok.month.toString().padLeft(2, '0');
  // Thai Buddhist Era year; explicitly display the Thailand time zone.
  return '$day/$month/${bangkok.year + 543} • ${lkMessageClock(date)} น. (เวลาไทย)';
}

class LKNotificationFeed extends StatelessWidget {
  const LKNotificationFeed({
    super.key,
    required this.messages,
    required this.onSelect,
    required this.search,
    required this.searchQuery,
    required this.onSearchChanged,
    required this.refreshing,
    required this.onRefresh,
  });
  final List<LKMessage> messages;
  final ValueChanged<LKMessage> onSelect;
  final String searchQuery;
  final bool search, refreshing;
  final ValueChanged<String> onSearchChanged;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final matches = searchQuery.trim().isEmpty
        ? messages
        : messages
              .where(
                (e) => e.body.toLowerCase().contains(searchQuery.toLowerCase()),
              )
              .toList();
    return Container(
      color: lkSoftBlue,
      child: RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 30),
          children: [
            if (search) ...[
              TextField(
                autofocus: false,
                onChanged: onSearchChanged,
                decoration: InputDecoration(
                  hintText: 'ค้นหาข้อความแจ้งเตือน',
                  prefixIcon: const Icon(Icons.search_rounded),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xffc0d0df),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'ข้อความล่าสุด • ${matches.length} รายการ',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            if (matches.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(
                  vertical: 50,
                  horizontal: 18,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: const Column(
                  children: [
                    Icon(
                      Icons.notifications_none,
                      size: 42,
                      color: lkBrandGreen,
                    ),
                    SizedBox(height: 12),
                    Text('ยังไม่มีข้อความในห้องนี้'),
                  ],
                ),
              ),
            for (final message in matches)
              Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => onSelect(message),
                    child: Padding(
                      padding: const EdgeInsets.all(13),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _MessageIcon(type: lkMessageType(message.body)),
                          const SizedBox(width: 11),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  lkMessageTitle(message.body),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: lkDarkText,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  message.body
                                      .replaceAll(RegExp(r'\s+'), ' ')
                                      .trim(),
                                  maxLines: 3,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Color(0xff56655d),
                                    fontSize: 12,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            lkMessageClock(message.createdUTC),
                            style: const TextStyle(
                              color: Color(0xff667e73),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MessageIcon extends StatelessWidget {
  const _MessageIcon({required this.type, this.size = 44});
  final LKMessageType type;
  final double size;
  @override
  Widget build(BuildContext context) {
    final color = lkMessageColor(type);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(lkMessageIcon(type), color: color, size: size * .55),
    );
  }
}

class LKMessageDetailPage extends StatelessWidget {
  const LKMessageDetailPage({
    super.key,
    required this.message,
    required this.onOpen,
  });
  final LKMessage message;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final type = lkMessageType(message.body);
    return Scaffold(
      appBar: AppBar(title: const Text('รายละเอียด')),
      backgroundColor: const Color(0xfff5f9f6),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _MessageIcon(type: type, size: 52),
                        const SizedBox(width: 13),
                        Expanded(
                          child: Text(
                            lkMessageTitle(message.body),
                            style: const TextStyle(
                              color: lkDarkText,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 28),
                    const Text(
                      'ข้อความแจ้งเตือน',
                      style: TextStyle(color: Color(0xff668272), fontSize: 12),
                    ),
                    const SizedBox(height: 10),
                    SelectableText(
                      message.body,
                      style: const TextStyle(
                        fontSize: 15,
                        height: 1.6,
                        color: lkDarkText,
                      ),
                    ),
                    const Divider(height: 28),
                    Text(
                      'เวลา ${lkMessageDateTime(message.createdUTC)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xff60786a),
                      ),
                    ),
                    if (message.target.isNotEmpty) ...[
                      const SizedBox(height: 22),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () => onOpen(message.target),
                          icon: const Icon(Icons.open_in_new),
                          label: const Text('เปิดในระบบ'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LKConnectionPage extends StatelessWidget {
  const LKConnectionPage({
    super.key,
    required this.roomName,
    required this.pushReady,
    this.pushServerConfigured = false,
    required this.onUnpair,
    this.onTestNotification,
    this.onOpenNotificationSettings,
  });
  final String roomName;
  final bool pushReady;
  final bool pushServerConfigured;
  final Future<bool> Function() onUnpair;
  final Future<bool> Function()? onTestNotification;
  final Future<bool> Function()? onOpenNotificationSettings;

  @override
  Widget build(BuildContext context) {
    final platform = Theme.of(context).platform;
    final isIOS = platform == TargetPlatform.iOS;
    final isAndroid = platform == TargetPlatform.android;
    final platformName = isIOS
        ? 'iPhone'
        : isAndroid
        ? 'Android'
        : 'อุปกรณ์';

    return Scaffold(
      appBar: AppBar(title: const Text('การเชื่อมต่อ')),
      backgroundColor: const Color(0xfff6faf7),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: const BoxDecoration(
                        color: lkSoftGreen,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check_circle,
                        size: 52,
                        color: lkBrandGreen,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'เชื่อมต่อแล้ว',
                      style: TextStyle(
                        color: lkDarkGreen,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'ประเภท: $roomName',
                      style: const TextStyle(fontSize: 15),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      !pushReady
                          ? 'อ่านข้อความในแอปได้ • ยังไม่ได้ลงทะเบียน FCM ของอุปกรณ์'
                          : pushServerConfigured
                          ? 'ลงทะเบียน FCM แล้ว • เซิร์ฟเวอร์ตั้งค่าระบบ Push แล้ว'
                          : 'ลงทะเบียน FCM แล้ว • รอเปิดระบบส่ง Push ที่เซิร์ฟเวอร์',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xff657b6f),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (onTestNotification != null) ...[
              OutlinedButton.icon(
                onPressed: () async {
                  final sent = await onTestNotification!();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          sent
                              ? 'ส่งแจ้งเตือนทดสอบแล้ว • ตรวจสอบเสียงและการแจ้งเตือนบน $platformName'
                              : 'ไม่สามารถส่งการแจ้งเตือนทดสอบได้ • ตรวจสอบสิทธิ์แจ้งเตือนบน $platformName',
                        ),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.notifications_active_outlined),
                label: Text(
                  isIOS
                      ? 'ทดสอบเสียง / ป้ายแจ้งเตือน / แบนเนอร์'
                      : 'ทดสอบเสียง / Badge / การแจ้งเตือน',
                ),
              ),
              const SizedBox(height: 8),
              if (onOpenNotificationSettings != null)
                TextButton.icon(
                  onPressed: () async {
                    final opened = await onOpenNotificationSettings!();
                    if (!opened && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            'ไม่สามารถเปิดการตั้งค่าการแจ้งเตือนบน $platformName ได้',
                          ),
                        ),
                      );
                    }
                  },
                  icon: const Icon(Icons.settings_outlined),
                  label: Text(
                    isIOS
                        ? 'ตั้งค่าเสียง / การแจ้งเตือนของ iPhone'
                        : isAndroid
                        ? 'ตั้งค่าอนุญาตเสียง / จุดแจ้งเตือนของ Android'
                        : 'ตั้งค่าการแจ้งเตือนของอุปกรณ์',
                  ),
                ),
              const Text(
                'ปุ่มนี้เป็นการทดสอบเสียงในเครื่อง ไม่ได้ส่ง FCM จากเซิร์ฟเวอร์ '
                'การรับแจ้งเตือนขณะปิดแอปต้องลงทะเบียนอุปกรณ์และเปิดระบบส่ง Push บนเซิร์ฟเวอร์',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: Color(0xff657b6f)),
              ),
              const SizedBox(height: 12),
            ],
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xffbc2d34),
                side: const BorderSide(color: Color(0xffecb8ba)),
                minimumSize: const Size.fromHeight(50),
              ),
              onPressed: () async {
                final removed = await onUnpair();
                if (removed && context.mounted) Navigator.pop(context);
              },
              icon: const Icon(Icons.link_off),
              label: const Text('ยกเลิกการเชื่อมต่อ'),
            ),
          ],
        ),
      ),
    );
  }
}
