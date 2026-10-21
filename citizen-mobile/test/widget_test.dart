import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patag_citizen/app/theme.dart';
import 'package:patag_citizen/features/screens.dart';
void main(){
 for(final width in [320.0,360.0,375.0,390.0,414.0,430.0,768.0]){
  testWidgets('welcome controls remain usable at width $width and scaled text',(tester)async{
   tester.view.physicalSize=Size(width,900);tester.view.devicePixelRatio=1;
   addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
   await tester.pumpWidget(MaterialApp(theme:patagTheme(),builder:(context,child)=>MediaQuery(data:MediaQuery.of(context).copyWith(textScaler:const TextScaler.linear(1.4)),child:child!),home:const Welcome()));
   await tester.pumpAndSettle();expect(find.text('Sign in'),findsOneWidget);expect(tester.takeException(),isNull);
  });
 }
}
