import 'models.dart';
class User {
 final String id,name,email;final Role role;final bool active;
 const User({required this.id,required this.name,required this.email,required this.role,this.active=true});
}
class Citizen extends User {const Citizen({required super.id,required super.name,required super.email,super.active}):super(role:Role.citizen);}
class LGUPersonnel extends User {const LGUPersonnel({required super.id,required super.name,required super.email,super.active}):super(role:Role.admin);}
class MaintenanceTeam {final String id,name;final List<String> members;final bool active;const MaintenanceTeam({required this.id,required this.name,required this.members,this.active=true});}
class ReportPhoto {final String id,url,name,kind;final bool demo;const ReportPhoto({required this.id,required this.url,required this.name,required this.kind,this.demo=false});Map<String,dynamic> toJson()=>{'id':id,'url':url,'name':name,'kind':kind,'demo':demo};}
class LocationDetails {final String road,barangay,city,province,landmark;final Coordinates coordinates;const LocationDetails({required this.road,required this.barangay,required this.city,required this.province,this.landmark='',required this.coordinates});}
enum ReportStatus {submitted,underReview,verified,assigned,inProgress,resolved,rejected,duplicate}
class ReportHistoryEntry {final String id,at,actor,action,note;final String? from;final String to;const ReportHistoryEntry({required this.id,required this.at,required this.actor,required this.action,required this.note,required this.from,required this.to});}
class Assignment {final String teamId,note,priority,at;final String? targetDate;const Assignment({required this.teamId,required this.note,required this.priority,required this.at,this.targetDate});}
class RepairProgressUpdate {final String at,note,phase;final List<ReportPhoto> photos;const RepairProgressUpdate({required this.at,required this.note,required this.phase,this.photos=const []});}
class RepairDocumentation {final List<ReportPhoto> before,after;final String note;const RepairDocumentation({required this.before,required this.after,required this.note});}
class CompletionVerification {final String state,note,at;final List<ReportPhoto> photos;const CompletionVerification({required this.state,required this.note,required this.at,required this.photos});}
class Notification {final String id,reportId,title,at;final bool read;const Notification({required this.id,required this.reportId,required this.title,required this.at,this.read=false});}
class ReportFeedback {final int rating;final String text,at;const ReportFeedback({required this.rating,required this.text,required this.at});}
class DuplicateCandidate {final PotholeReport report;final int distance;const DuplicateCandidate({required this.report,required this.distance});}
class AgencyJurisdiction {final String id,name;final List<String> municipalities;const AgencyJurisdiction({required this.id,required this.name,required this.municipalities});}
