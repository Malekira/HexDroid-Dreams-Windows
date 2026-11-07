const{test}=require('node:test'),assert=require('node:assert/strict');const{avatarUrl}=require('../src/services/avatar-policy');const{validateSettings}=require('../src/storage');
test('Shared avatar URL templates are persisted and substitute only escaped nicknames',()=>{const url='https://example.org/photos/{nickLower}.jpg';const settings=validateSettings({avatarUrlTemplate:url,autoAvatars:true,mediaEnabled:true});assert.equal(settings.avatarUrlTemplate,url);assert.equal(avatarUrl(url,'ALIce'),'https://example.org/photos/alice.jpg');assert.equal(avatarUrl('https://example.org/{nick}.png','Nick[1]'),'https://example.org/Nick%5B1%5D.png');assert.throws(()=>avatarUrl('file:///tmp/{nick}','Alice'));assert.throws(()=>avatarUrl('https://u:p@example.org/{nick}','Alice'));assert.throws(()=>avatarUrl('https://example.org/{nick}','Alice!ident@host'));});
const{legacyPhoto,normalizePhoto,resolveAvatar}=require('../src/services/avatar-policy');
test('Chat legacy GECOS decodes only a photo path from the official hosts',()=>{
 const encode=value=>Buffer.from('#|female|42|'+value).toString('base64');
 assert.equal(legacyPhoto(encode('/avatar/Chat/Alice.png')),'https://chat-avatars.chateagratis.net/avatar/Chat/Alice.png');
 assert.equal(legacyPhoto(encode('http://images.chateagratis.net/avatar/Chat/Alice.png')),'https://chat-avatars.chateagratis.net/avatar/Chat/Alice.png');
 for(const value of ['https://evil.example/a.png','//evil.example/a.png','https://images.chateagratis.net.evil.example/a.png','?v=1','#'])assert.equal(legacyPhoto(encode(value)),null);
 assert.equal(legacyPhoto('Nombre real normal'),null);assert.equal(normalizePhoto('file:///tmp/image.png'),null);
});
test('Avatar resolution prioritizes metadata, handles removal, and versions the official fallback without changing explicit metadata versions',()=>{
 const template='https://chat-avatars.chateagratis.net/avatar/Chat/{Nick}.png',state={metadata:{avatar:'https://chat-avatars.chateagratis.net/published.png?v=123'},legacyPhoto:'/legacy.png',avatarVersion:3};
 assert.equal(resolveAvatar({state,nick:'ALIce',template,now:120000}).url,'https://chat-avatars.chateagratis.net/published.png?v=123');
 assert.equal(resolveAvatar({state:{metadata:{avatar:''},legacyPhoto:'/legacy.png'},nick:'Alice',template}).url,null);
 assert.equal(resolveAvatar({state:{legacyPhoto:'/legacy.png'},nick:'Alice',template,now:120000}).url,'https://chat-avatars.chateagratis.net/legacy.png?v=2');
 assert.equal(resolveAvatar({nick:'ALIce',template,now:120000}).url,'https://chat-avatars.chateagratis.net/avatar/Chat/ALIce.png?v=2');
 assert.notEqual(resolveAvatar({nick:'Alice',template,now:120000}).url,resolveAvatar({nick:'Alice',template,now:180000}).url);
 assert.equal(resolveAvatar({nick:'Alice',template,state:{metadata:{avatar:'https://unconfigured.example/photo.png'}},automatic:true}).blocked,true);
});
test('Web GECOS metadata is not displayed as an encoded real name; ordinary names are preserved',()=>{
 const {displayRealName}=require('../src/services/avatar-policy');
 assert.equal(displayRealName(Buffer.from('#|female|42|/avatar/Chat/Alice.png').toString('base64')),'Nombre real no facilitado');
 for(const text of ['Nombre de Alice','\x0313Nombre con color','YWJjZA=='])assert.equal(displayRealName(text),text);
});
test('Message thumbnail loading is independent of user-list photos and still honors the multimedia master switch',async()=>{
 const {Runtime}=require('../src/services/runtime');let calls=0;const client={},settings={mediaEnabled:true,showAvatars:false,showMessageAvatars:true,autoAvatars:true};
 const body=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 const context={sessions:{get:()=>client},getConfig:()=>({settings}),avatarCache:new Map(),resolvePhoto:()=>({url:'https://photos.example/alice.png',version:1,client}),web:{request:async()=>{calls++;return{status:200,body};}},electron:{nativeImage:{createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>({width:1,height:1}),resize:()=>({toDataURL:()=> 'data:image/png;base64,'+body.toString('base64')})})}}};
 const result=await Runtime.prototype.action.call(context,'avatar.load',{network:'net',nick:'Alice'});assert.match(result.image,/^data:image\/png/);assert.equal(calls,1);
 settings.showMessageAvatars=false;assert.equal((await Runtime.prototype.action.call(context,'avatar.load',{network:'net',nick:'Alice'})).disabled,true);assert.equal(calls,1);
 settings.showMessageAvatars=true;settings.mediaEnabled=false;assert.equal((await Runtime.prototype.action.call(context,'avatar.load',{network:'net',nick:'Alice'})).disabled,true);
 assert.equal(validateSettings({showMessageAvatars:false}).showMessageAvatars,false);
});
