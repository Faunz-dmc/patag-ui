import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patag_citizen/app/theme.dart';
import 'package:patag_citizen/features/screens.dart';
void main(){
 testWidgets('registration validates each step and preserves identity when going back',(tester)async{
  await tester.pumpWidget(MaterialApp(theme:patagTheme(),home:const AuthScreen('register')));
  await tester.tap(find.text('Continue'));await tester.pumpAndSettle();
  expect(find.text('Step 1 of 2 · About you'),findsOneWidget);
  await tester.enterText(find.byType(TextFormField).at(0),'Test Citizen');
  await tester.enterText(find.byType(TextFormField).at(1),'citizen@example.test');
  await tester.tap(find.text('Continue'));await tester.pumpAndSettle();
  expect(find.text('Step 2 of 2 · Secure your account'),findsOneWidget);
  await tester.enterText(find.byType(TextFormField).first,'short');
  await tester.ensureVisible(find.widgetWithText(FilledButton,'Create account'));
  await tester.tap(find.widgetWithText(FilledButton,'Create account'));await tester.pumpAndSettle();
  expect(find.text('Use 15 to 128 characters.'),findsOneWidget);
  await tester.ensureVisible(find.text('Back to your details'));await tester.tap(find.text('Back to your details'));await tester.pumpAndSettle();
  expect(find.text('Test Citizen'),findsOneWidget);expect(find.text('citizen@example.test'),findsOneWidget);expect(tester.takeException(),isNull);
 });
}
