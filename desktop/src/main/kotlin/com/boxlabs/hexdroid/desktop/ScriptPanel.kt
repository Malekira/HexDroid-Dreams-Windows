/* HexDroidIRC — Copyright (C) 2026 boxlabs. GPL-3.0-or-later. */
package com.boxlabs.hexdroid.desktop

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import com.boxlabs.hexdroid.script.*
import com.boxlabs.hexdroid.connection.ProxyType
import kotlin.math.*

private fun scriptColor(value:String?):Color = value?.removePrefix("#")?.takeIf { it.length in setOf(6,8) }?.toLongOrNull(16)?.let { Color(if(value.removePrefix("#").length==6)it or 0xff000000L else it) } ?: Color.Unspecified
@Composable internal fun ScriptPanel(view:ScriptView,controller:DesktopController,depth:Int=0) {
    if(depth>32){Text("Vista del script demasiado profunda");return}
    val p=view.props
    val shape=if(p.circle)CircleShape else RoundedCornerShape(8.dp)
    var modifier:Modifier=Modifier
    if(p.fillWidth)modifier=modifier.fillMaxWidth()
    p.widthDp?.let{modifier=modifier.width(it.coerceIn(1,2000).dp)};p.heightDp?.let{modifier=modifier.height(it.coerceIn(1,1600).dp)}
    if(p.offsetXDp!=0 || p.offsetYDp!=0)modifier=modifier.offset(p.offsetXDp.dp,p.offsetYDp.dp)
    if(p.bg!=null)modifier=modifier.background(scriptColor(p.bg).takeUnless{it==Color.Unspecified} ?: Color.Transparent,shape)
    p.gradient?.split(':')?.takeIf { it.size==3 }?.let { a->val colors=a.drop(1).map(::scriptColor);if(colors.none{it==Color.Unspecified})modifier=modifier.background(if(a[0]=="radial")Brush.radialGradient(colors) else Brush.linearGradient(colors),shape) }
    if(p.borderColor!=null)modifier=modifier.border(p.borderWidthDp.dp,scriptColor(p.borderColor),shape)
    modifier=modifier.padding(p.padDp.dp)
    when(view) {
        is ScriptView.Column->Column(modifier,verticalArrangement=Arrangement.spacedBy(p.gapDp.dp)){view.children.forEach{child->Box(if(child.props.weight!=null)Modifier.weight(child.props.weight!!) else Modifier){ScriptPanel(child,controller,depth+1)}}}
        is ScriptView.Row->Row(modifier,horizontalArrangement=Arrangement.spacedBy(p.gapDp.dp),verticalAlignment=Alignment.CenterVertically){view.children.forEach{child->Box(if(child.props.weight!=null)Modifier.weight(child.props.weight!!) else Modifier){ScriptPanel(child,controller,depth+1)}}}
        is ScriptView.Stack->Box(modifier){view.children.forEach{child->val align=when(child.props.align){"center"->Alignment.Center;"end"->Alignment.CenterEnd;"bottom"->Alignment.BottomCenter;"top"->Alignment.TopCenter;else->Alignment.TopStart};Box(Modifier.align(align)){ScriptPanel(child,controller,depth+1)}}}
        is ScriptView.Ring-> {
            val diameter=(p.sizeDp ?: 150).coerceIn(30,600)*2
            Layout(content={view.children.forEach{ScriptPanel(it,controller,depth+1)}},modifier=modifier.size(diameter.dp,(diameter*(p.ratio ?: 0.6f)).coerceAtLeast(60f).dp)) { measurables,constraints ->
                val width=constraints.maxWidth;val height=constraints.maxHeight
                val children=measurables.mapIndexed { index,m->if(view.children[index].props.felt)m.measure(androidx.compose.ui.unit.Constraints.fixed(width,height)) else m.measure(constraints.copy(minWidth=0,minHeight=0,maxWidth=(width/2).coerceAtLeast(1),maxHeight=(height/2).coerceAtLeast(1))) }
                val count=view.children.count{!it.props.felt}.coerceAtLeast(1)
                layout(width,height){var seat=0;children.forEachIndexed { i,c->if(view.children[i].props.felt)c.placeRelative(0,0) else {val angle=PI/2+seat++*2*PI/count;c.placeRelative((width/2.0+(width-c.width)/2.0*cos(angle)-c.width/2).toInt(),(height/2.0+(height-c.height)/2.0*sin(angle)-c.height/2).toInt())} }}
            }
        }
        is ScriptView.Surface->Box(modifier.clip(shape)){p.bgImage?.let{ScriptImage(it,Modifier.matchParentSize(),controller)};view.child?.let{ScriptPanel(it,controller,depth+1)}}
        is ScriptView.Text->Text(view.text,modifier,color=scriptColor(p.color),fontSize=(p.textSp ?: 14).sp,fontWeight=if(p.bold)FontWeight.Bold else null)
        is ScriptView.Button->Button(onClick={controller.scriptAction(view.actionId,view.args)},modifier=modifier){Text(view.label)}
        is ScriptView.Card->Surface(modifier.size((p.sizeDp ?: 42).dp,((p.sizeDp ?: 42)*1.4f).dp),shape=RoundedCornerShape(5.dp),color=if(view.back)Color(0xff17446b) else Color.White,border=BorderStroke(1.dp,Color.Gray)) {Box(contentAlignment=Alignment.Center){Text(if(view.back)"◆" else view.face,color=if(view.back)Color.White else if(view.red)Color.Red else Color.Black,fontWeight=FontWeight.Bold)}}
        is ScriptView.Image->ScriptImage(view.url,modifier.size((p.sizeDp ?: 80).dp),controller)
        is ScriptView.Spacer->Spacer(modifier.size((p.sizeDp ?: 8).dp))
    }
}
@Composable private fun ScriptImage(url:String,modifier:Modifier,controller:DesktopController) {
    var image by remember(url){mutableStateOf<ImageBitmap?>(null)}
    val blocked=controller.state.profiles.any { it.proxyType!=ProxyType.NONE } || !controller.state.settings.scriptNetwork
    LaunchedEffect(url,blocked){if(!blocked)image=DesktopImages.load(url)?.let(::bufferedImageToBitmap)}
    Box(modifier,contentAlignment=Alignment.Center){if(image!=null)Image(image!!,null,Modifier.fillMaxSize(),contentScale=ContentScale.Fit) else Text(if(blocked)"HTTPS desactivado" else "Imagen no disponible",style=MaterialTheme.typography.labelSmall)}
}
