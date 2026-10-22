import 'package:flutter/material.dart';

const ink = Color(0xFF182B49), orange = Color(0xFFF26A32);
const paper = Color(0xFFF7F1EB), slate = Color(0xFF586471);
const peach = Color(0xFFFDD3BC), palePeach = Color(0xFFFEE8DD);
const quiet = Color(0xFFF5F5F2), line = Color(0xFFD6DADB);

abstract final class PatagTokens {
  static const double gap = 20, radius = 24, fieldRadius = 16;
  static const Duration motion = Duration(milliseconds: 160);
}

ThemeData patagTheme() => ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: Colors.white,
  fontFamily: 'Arial',
  colorScheme: ColorScheme.fromSeed(
    seedColor: ink,
    primary: ink,
    secondary: orange,
    surface: Colors.white,
    onSurface: ink,
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: Colors.white,
    foregroundColor: ink,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    scrolledUnderElevation: 0,
    centerTitle: false,
    toolbarHeight: 64,
  ),
  textTheme: const TextTheme(
    headlineLarge: TextStyle(
      fontFamily: 'Lilita One',
      fontSize: 36,
      color: ink,
      height: 1.08,
    ),
    headlineMedium: TextStyle(
      fontFamily: 'Lilita One',
      fontSize: 30,
      color: ink,
      height: 1.12,
    ),
    titleLarge: TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: ink,
    ),
    titleMedium: TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
      color: ink,
    ),
    bodyLarge: TextStyle(fontSize: 16, height: 1.5, color: ink),
    bodyMedium: TextStyle(fontSize: 14, height: 1.5, color: ink),
    bodySmall: TextStyle(fontSize: 12, height: 1.5, color: slate),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: quiet,
    labelStyle: const TextStyle(color: slate, fontSize: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: line),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: line),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: ink, width: 2),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: ink,
      foregroundColor: Colors.white,
      minimumSize: const Size(48, 52),
      shape: const StadiumBorder(),
      textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: ink,
      minimumSize: const Size(48, 50),
      side: const BorderSide(color: line),
      shape: const StadiumBorder(),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: ink,
      minimumSize: const Size(44, 44),
      textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
    ),
  ),
  cardTheme: CardThemeData(
    color: quiet,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    margin: const EdgeInsets.only(bottom: 14),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
  ),
  listTileTheme: const ListTileThemeData(
    contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
    iconColor: ink,
    textColor: ink,
    minVerticalPadding: 14,
  ),
  dividerTheme: const DividerThemeData(color: line, space: 28, thickness: 1),
  chipTheme: ChipThemeData(
    backgroundColor: quiet,
    side: BorderSide.none,
    shape: const StadiumBorder(),
    labelStyle: const TextStyle(color: ink, fontSize: 12),
  ),
  dialogTheme: DialogThemeData(
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
  ),
  bottomSheetTheme: const BottomSheetThemeData(
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
  ),
  snackBarTheme: SnackBarThemeData(
    backgroundColor: ink,
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
  ),
  navigationBarTheme: const NavigationBarThemeData(
    backgroundColor: Colors.white,
    indicatorColor: palePeach,
  ),
);
