export const SIGMA_CHUNK_1: string = `attribute float a_size;
attribute float a_angle;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;

varying vec4 v_color;
varying vec2 v_diffVector;
varying float v_radius;
varying float v_border;

const float bias = 255.0 / 254.0;

void main() {
  float size = a_size * u_correctionRatio / u_sizeRatio * 4.0;
  vec2 diffVector = size * vec2(cos(a_angle), sin(a_angle));
  vec2 position = a_position + diffVector;
  gl_Position = vec4(
    (u_matrix * vec3(position, 1)).xy,
    0,
    1
  );

  v_diffVector = diffVector;
  v_radius = size / 2.0;

  #ifdef PICKING_MODE
  // For picking mode, we use the ID as the color:
  v_color = a_id;
  #else
  // For normal mode, we use the color:
  v_color = a_color;
  #endif

  v_color.a *= bias;
}
\`,W7=X7,RJ=WebGLRenderingContext,GJ=RJ.UNSIGNED_BYTE,EQ=RJ.FLOAT,V7=["u_sizeRatio","u_correctionRatio","u_matrix"],s0=function(X){function W(){return r(this,W),X0(this,W,arguments)}return W0(W,X),a(W,[{key:"getDefinition",value:function(){return{VERTICES:3,VERTEX_SHADER_SOURCE:W7,FRAGMENT_SHADER_SOURCE:K7,METHOD:WebGLRenderingContext.TRIANGLES,UNIFORMS:V7,ATTRIBUTES:[{name:"a_position",size:2,type:EQ},{name:"a_size",size:1,type:EQ},{name:"a_color",size:4,type:GJ,normalized:!0},{name:"a_id",size:4,type:GJ,normalized:!0}],CONSTANT_ATTRIBUTES:[{name:"a_angle",size:1,type:EQ}],CONSTANT_DATA:[[W.ANGLE_1],[W.ANGLE_2],[W.ANGLE_3]]}}},{key:"processVisibleItem",value:function(Q,Z,j){var G=this.array,B=m0(j.color);G[Z++]=j.x,G[Z++]=j.y,G[Z++]=j.size,G[Z++]=B,G[Z++]=Q}},{key:"setUniforms",value:function(Q,Z){var{gl:j,uniformLocations:G}=Z,B=G.u_sizeRatio,M=G.u_correctionRatio,$=G.u_matrix;j.uniform1f(M,Q.correctionRatio),j.uniform1f(B,Q.sizeRatio),j.uniformMatrix3fv($,!1,Q.matrix)}}])}(J7);T(s0,"ANGLE_1",0);T(s0,"ANGLE_2",2*Math.PI/3);T(s0,"ANGLE_3",4*Math.PI/3);var Y7=\`
precision mediump float;

`
