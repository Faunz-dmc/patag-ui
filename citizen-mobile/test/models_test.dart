import 'package:flutter_test/flutter_test.dart';
import 'package:patag_citizen/core/models.dart';
void main(){
 test('manual coordinates reject invalid ranges and missing values',(){
  expect(const Coordinates(14.85,120.81).isValid,isTrue);
  expect(const Coordinates(91,120).isValid,isFalse);
  expect(Coordinates(double.nan,120).isValid,isFalse);
  expect(const Coordinates(14,181).isValid,isFalse);
 });
 test('canonical statuses retain administrative resolution boundary',(){
  expect(reportStatuses,['Submitted','Under Review','Verified','Assigned','In Progress','Resolved','Rejected','Duplicate']);
  expect(reportStatuses.contains('Awaiting Verification'),isFalse);
 });
}
