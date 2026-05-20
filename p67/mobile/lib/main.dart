import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'app/routes/app_pages.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: '民俗活动平台',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFFC41E3A),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFC41E3A),
          primary: const Color(0xFFC41E3A),
          secondary: const Color(0xFFD4AF37),
        ),
        useMaterial3: true,
        fontFamily: 'PingFang SC',
      ),
      initialRoute: AppPages.INITIAL,
      getPages: AppPages.routes,
    );
  }
}
