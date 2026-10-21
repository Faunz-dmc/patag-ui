const reportStatuses = ['Submitted', 'Under Review', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Rejected',
'Duplicate'];
enum Role {
  citizen, admin, maintenance
}
enum Severity {
  low, medium, high
}
class Coordinates {
  final double lat, lng;
  const Coordinates(this.lat, this.lng);
  factory Coordinates.fromJson(Map<String, dynamic> json) => Coordinates((json['lat'] as num).toDouble(),
  (json['lng'] as num).toDouble());
  Map<String, dynamic> toJson() => {
    'lat': lat, 'lng': lng
  }
  ;
  bool get isValid => lat.isFinite && lng.isFinite && lat.abs() <= 90 && lng.abs() <= 180;
}
class PotholeReport {
  final Map<String, dynamic> json;
  PotholeReport(this.json);
  String get id => json['id'] as String;
  String get title => json['title'] as String;
  String get status => json['status'] as String;
  String get severity => json['severity'] as String;
  String get road => json['location']['road'] as String;
  String get barangay => json['location']['barangay'] as String;
  String get description => json['description'] as String;
  Coordinates get coordinates => Coordinates.fromJson(Map<String, dynamic>.from(json['location']['coordinates']));
  List<dynamic> get photos => json['photos'] as List<dynamic>;
  List<dynamic> get history => json['history'] as List<dynamic>;
}
// The full JSON fields (Assignment, ReportHistoryEntry, CompletionVerification,
// ReportPhoto, LocationDetails, RepairProgressUpdate, RepairDocumentation,
// ReportFeedback, DuplicateCandidate and AgencyJurisdiction) follow docs/api-contract.md.
// Flutter owns these Dart models; it does not import TypeScript code.
