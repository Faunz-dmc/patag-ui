import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:patag_citizen/main.dart' as app;
void main(){
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('launch reaches a usable authentication entry',(tester)async{
    SharedPreferences.setMockInitialValues({
      'onboarded':true
    }
    );
    await app.main();
    await tester.pumpAndSettle();
    expect(find.text('Sign in'),findsOneWidget);
    expect(find.text('Create an account'),findsOneWidget);
  }
  );
}
