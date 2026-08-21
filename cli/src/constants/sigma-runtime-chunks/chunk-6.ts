export const SIGMA_CHUNK_6: string = `  v_color = a_color;
  #endif

  v_color.a *= bias;
}
\`,N7=B7,kJ=WebGLRenderingContext,NJ=kJ.UNSIGNED_BYTE,S0=kJ.FLOAT,M7=["u_matrix","u_zoomRatio","u_sizeRatio","u_correctionRatio","u_pixelRatio","u_feather","u_minEdgeThickness","u_lengthToThicknessRatio"],$7={lengthToThicknessRatio:TJ.lengthToThicknessRatio};function CJ(X){var W=f(f({},$7),X||{});return function(K){function Q(){return r(this,Q),X0(this,Q,arguments)}return W0(Q,K),a(Q,[{key:"getDefinition",value:function(){return{VERTICES:6,VERTEX_SHADER_SOURCE:N7,FRAGMENT_SHADER_SOURCE:IJ,METHOD:WebGLRenderingContext.TRIANGLES,UNIFORMS:M7,ATTRIBUTES:[{name:"a_positionStart",size:2,type:S0},{name:"a_positionEnd",size:2,type:S0},{name:"a_normal",size:2,type:S0},{name:"a_color",size:4,type:NJ,normalized:!0},{name:"a_id",size:4,type:NJ,normalized:!0},{name:"a_radius",size:1,type:S0}],CONSTANT_ATTRIBUTES:[{name:"a_positionCoef",size:1,type:S0},{name:"a_normalCoef",size:1,type:S0},{name:"a_radiusCoef",size:1,type:S0}],CONSTANT_DATA:[[0,1,0],[0,-1,0],[1,1,1],[1,1,1],[0,-1,0],[1,-1,-1]]}}},{key:"processVisibleItem",value:function(j,G,B,M,$){var w=$.size||1,O=B.x,D=B.y,I=M.x,P=M.y,v=m0($.color),x=I-O,m=P-D,y=M.size||1,u=x*x+m*m,E=0,o=0;if(u)u=1/Math.sqrt(u),E=-m*u*w,o=x*u*w;var l=this.array;l[G++]=O,l[G++]=D,l[G++]=I,l[G++]=P,l[G++]=E,l[G++]=o,l[G++]=v,l[G++]=j,l[G++]=y}},{key:"setUniforms",value:function(j,G){var{gl:B,uniformLocations:M}=G,$=M.u_matrix,w=M.u_zoomRatio,O=M.u_feather,D=M.u_pixelRatio,I=M.u_correctionRatio,P=M.u_sizeRatio,v=M.u_minEdgeThickness,x=M.u_lengthToThicknessRatio;B.uniformMatrix3fv($,!1,j.matrix),B.uniform1f(w,j.zoomRatio),B.uniform1f(P,j.sizeRatio),B.uniform1f(I,j.correctionRatio),B.uniform1f(D,j.pixelRatio),B.uniform1f(O,j.antiAliasingFeather),B.uniform1f(v,j.minEdgeThickness),B.uniform1f(x,W.lengthToThicknessRatio)}}])}(vQ)}var F9=CJ();function F7(X){return Z7([CJ(X),DJ(X)])}var w7=F7(),bJ=w7,O7=\`
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_normal;
attribute float a_normalCoef;
attribute vec2 a_positionStart;
attribute vec2 a_positionEnd;
attribute float a_positionCoef;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_zoomRatio;
uniform float u_pixelRatio;
uniform float u_correctionRatio;
uniform float u_minEdgeThickness;
uniform float u_feather;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;

const float bias = 255.0 / 254.0;

void main() {
  float minThickness = u_minEdgeThickness;

  vec2 normal = a_normal * a_normalCoef;
  vec2 position = a_positionStart * (1.0 - a_positionCoef) + a_positionEnd * a_positionCoef;

  float normalLength = length(normal);
  vec2 unitNormal = normal / normalLength;

  // We require edges to be at least "minThickness" pixels thick *on screen*
  // (so we need to compensate the size ratio):
`
