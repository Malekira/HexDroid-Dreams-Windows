// Independent JCE fixtures using the wire layout from Android AesGcmCipher/BlowfishCipher.
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
public class InteropVectors {
 public static void main(String[] args) throws Exception {
  byte[] key=new byte[32],nonce=new byte[12],iv=new byte[8];for(int i=0;i<key.length;i++)key[i]=(byte)i;for(int i=0;i<nonce.length;i++)nonce[i]=(byte)(i+32);for(int i=0;i<iv.length;i++)iv[i]=(byte)(i+64);
  String text="Android y Windows: hola ✓",context="#dreams";byte[] plain=text.getBytes(StandardCharsets.UTF_8);
  Cipher aes=Cipher.getInstance("AES/GCM/NoPadding");aes.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,nonce));aes.updateAAD(context.getBytes(StandardCharsets.UTF_8));byte[] ct=aes.doFinal(plain),wire=new byte[1+nonce.length+ct.length];wire[0]=1;System.arraycopy(nonce,0,wire,1,12);System.arraycopy(ct,0,wire,13,ct.length);
  Cipher fish=Cipher.getInstance("Blowfish/CBC/NoPadding");fish.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"Blowfish"),new IvParameterSpec(iv));byte[] padded=Arrays.copyOf(plain,((plain.length+7)/8)*8),f=fish.doFinal(padded),fw=new byte[8+f.length];System.arraycopy(iv,0,fw,0,8);System.arraycopy(f,0,fw,8,f.length);
  Base64.Encoder b64=Base64.getEncoder();System.out.println("{\"key\":\""+b64.encodeToString(key)+"\",\"text\":\""+text+"\",\"target\":\""+context+"\",\"agm\":\"+AGM "+b64.withoutPadding().encodeToString(wire)+"\",\"fish\":\"+OK *"+b64.encodeToString(fw)+"\"}");
 }
}
