import 'package:flutter/material.dart';
import '../../app/theme.dart';
import '../../core/api.dart';
import '../../core/models.dart';
void go(BuildContext context,String route)=>Navigator.of(context).pushNamed(route);
void home(BuildContext context)=>Navigator.of(context).pushNamedAndRemoveUntil('/home',(route)=>false);
void message(BuildContext context,String text)=>ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(text)));
Widget logo({
  double width=135
}
)=>Image.asset('assets/images/patag-logo.png',width:width,semanticLabel:'PATAG');
Widget mascot({
  double width=160
}
)=>Image.asset('assets/images/patag-mascot.png',width:width,excludeFromSemantics:true);
Widget heading(BuildContext c,String text)=>Text(text,style:Theme.of(c).textTheme.headlineMedium);
Widget gap([double height=16])=>SizedBox(height:height);
Widget action(String label,VoidCallback? press,{
  IconData icon=Icons.arrow_forward
}
)=>FilledButton(onPressed:press,child:Row(mainAxisAlignment:MainAxisAlignment.center,children:[Flexible(child:Text(label,
textAlign:TextAlign.center)),const SizedBox(width:10),Icon(icon,size:18)]));
Widget field(String label,TextEditingController ctrl,{
  int lines=1,TextInputType? keyboard,bool required=true,ValueChanged<String>? onChanged
}
)=>Padding(padding:const EdgeInsets.only(bottom:16),child:TextFormField(controller:ctrl,maxLines:lines,keyboardType:keyboard,
onChanged:onChanged,decoration:InputDecoration(labelText:label),validator:(s)=>required&&(s==null||s.trim().isEmpty)?'$label is required.':null));
class StatusChip extends StatelessWidget{
  final String value;
  const StatusChip(this.value,{
    super.key
  }
  );
  @override Widget build(BuildContext context){
    final success=['Resolved','Verified'].contains(value);
    return Container(padding:const EdgeInsets.symmetric(horizontal:10,vertical:6),decoration:BoxDecoration(color:success?const Color(0xFFE8F2ED):value=='High'?const Color(0xFFFEE8DD):const Color(0xFFEDF0F5),
    borderRadius:BorderRadius.circular(8)),child:Text(value,style:TextStyle(fontSize:12,color:success?const Color(0xFF21633F):ink,
    fontWeight:FontWeight.bold)));
  }
}
class Evidence extends StatelessWidget{
  final Map<String,dynamic> photo;
  const Evidence(this.photo,{
    super.key
  }
  );
  @override Widget build(BuildContext context)=>ClipRRect(borderRadius:BorderRadius.circular(14),child:photo['demo']==true?Container(height:170,
  width:double.infinity,color:const Color(0xFFE5E8EA),child:const Column(mainAxisAlignment:MainAxisAlignment.center,
  children:[Icon(Icons.add_road,size:46,color:ink),Text('Illustrated demo evidence')])):Image.network(store.photoUrl(photo['url']),
  height:190,width:double.infinity,fit:BoxFit.cover,errorBuilder:(_,error,stack)=>const SizedBox(height:130,
  child:Center(child:Text('Photo unavailable. Check your connection.')))));
}
class ReportCard extends StatelessWidget{
  final PotholeReport report;
  final bool public;
  const ReportCard(this.report,{
    this.public=false,super.key
  }
  );
  @override Widget build(BuildContext context)=>Card(child:InkWell(borderRadius:BorderRadius.circular(20),
  onTap:()=>go(context,public?'/map/reports/${report.id}':'/reports/${report.id}'),child:Padding(padding:const EdgeInsets.all(16),
  child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[if(report.photos.isNotEmpty)Evidence(Map<String,
  dynamic>.from(report.photos.first)),gap(14),Row(children:[Expanded(child:Text(report.road,style:const TextStyle(fontSize:17,
  fontWeight:FontWeight.bold))),const Icon(Icons.arrow_outward,size:18)]),gap(6),Text('Brgy. ${report.barangay}',
  style:const TextStyle(color:slate,fontSize:12)),gap(12),Wrap(spacing:8,runSpacing:8,children:[StatusChip(report.status),
  StatusChip(report.severity)]),gap(10),Text(report.id,style:const TextStyle(fontSize:11,color:slate))]))));
}
class EmptyState extends StatelessWidget{
  final String title,text;
  const EmptyState(this.title,this.text,{
    super.key
  }
  );
  @override Widget build(BuildContext context)=>Padding(padding:const EdgeInsets.symmetric(vertical:32,horizontal:16),
  child:Column(children:[mascot(width:100),gap(),heading(context,title),gap(10),Text(text,textAlign:TextAlign.center,
  style:const TextStyle(color:slate))]));
}
class Screen extends StatelessWidget{
  final String title;
  final Widget body;
  final int? selected;
  final List<Widget>? actions;
  const Screen({
    required this.title,required this.body,this.selected,this.actions,super.key
  }
  );
  @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:Text(title,style:const TextStyle(fontSize:17,
  fontWeight:FontWeight.bold)),actions:actions),body:SafeArea(child:Column(children:[if(store.networkError!=null)MaterialBanner(content:Text(store.networkError!),
  actions:[TextButton(onPressed:()=>store.refresh().catchError((Object e){
    if(context.mounted)message(context,PatagStore.clean(e));
  }
  ),child:const Text('Retry'))]),Expanded(child:body)])),bottomNavigationBar:selected==null?null:NavigationBar(selectedIndex:selected!,
  labelBehavior:NavigationDestinationLabelBehavior.alwaysShow,onDestinationSelected:(i){
    final route=['/home','/map','/report/new','/reports','/profile'][i];
    if(i==2){
      go(context,route);
    }
    else{
      Navigator.of(context).pushReplacementNamed(route);
    }
  }
  ,destinations:const [NavigationDestination(icon:Icon(Icons.home_outlined),label:'Home'),NavigationDestination(icon:Icon(Icons.map_outlined),
  label:'Map'),NavigationDestination(icon:Icon(Icons.add_circle,color:orange),label:'Report'),NavigationDestination(icon:Icon(Icons.assignment_outlined),
  label:'My reports'),NavigationDestination(icon:Icon(Icons.person_outline),label:'Profile')]));
}
