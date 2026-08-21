export const SIGMA_CHUNK_3: string = `  float webGLArrowHeadLength = webGLThickness * u_lengthToThicknessRatio * 2.0;
  float webGLArrowHeadThickness = webGLThickness * u_widenessToThicknessRatio;

  float da = a_barycentric.x;
  float db = a_barycentric.y;
  float dc = a_barycentric.z;

  vec2 delta = vec2(
      da * (webGLNodeRadius * unitNormal.y)
    + db * ((webGLNodeRadius + webGLArrowHeadLength) * unitNormal.y + webGLArrowHeadThickness * unitNormal.x)
    + dc * ((webGLNodeRadius + webGLArrowHeadLength) * unitNormal.y - webGLArrowHeadThickness * unitNormal.x),

      da * (-webGLNodeRadius * unitNormal.x)
    + db * (-(webGLNodeRadius + webGLArrowHeadLength) * unitNormal.x + webGLArrowHeadThickness * unitNormal.y)
    + dc * (-(webGLNodeRadius + webGLArrowHeadLength) * unitNormal.x - webGLArrowHeadThickness * unitNormal.y)
  );

  vec2 position = (u_matrix * vec3(a_position + delta, 1)).xy;

  gl_Position = vec4(position, 0, 1);

  #ifdef PICKING_MODE
  // For picking mode, we use the ID as the color:
  v_color = a_id;
  #else
  // For normal mode, we use the color:
  v_color = a_color;
  #endif

  v_color.a *= bias;
}
\`,j7=z7,AJ=WebGLRenderingContext,BJ=AJ.UNSIGNED_BYTE,ZQ=AJ.FLOAT,H7=["u_matrix","u_sizeRatio","u_correctionRatio","u_minEdgeThickness","u_lengthToThicknessRatio","u_widenessToThicknessRatio"],TJ={extremity:"target",lengthToThicknessRatio:2.5,widenessToThicknessRatio:2};function DJ(X){var W=f(f({},TJ),X||{});return function(K){function Q(){return r(this,Q),X0(this,Q,arguments)}return W0(Q,K),a(Q,[{key:"getDefinition",value:function(){return{VERTICES:3,VERTEX_SHADER_SOURCE:j7,FRAGMENT_SHADER_SOURCE:U7,METHOD:WebGLRenderingContext.TRIANGLES,UNIFORMS:H7,ATTRIBUTES:[{name:"a_position",size:2,type:ZQ},{name:"a_normal",size:2,type:ZQ},{name:"a_radius",size:1,type:ZQ},{name:"a_color",size:4,type:BJ,normalized:!0},{name:"a_id",size:4,type:BJ,normalized:!0}],CONSTANT_ATTRIBUTES:[{name:"a_barycentric",size:3,type:ZQ}],CONSTANT_DATA:[[1,0,0],[0,1,0],[0,0,1]]}}},{key:"processVisibleItem",value:function(j,G,B,M,$){if(W.extremity==="source"){var w=[M,B];B=w[0],M=w[1]}var O=$.size||1,D=M.size||1,I=B.x,P=B.y,v=M.x,x=M.y,m=m0($.color),y=v-I,u=x-P,E=y*y+u*u,o=0,l=0;if(E)E=1/Math.sqrt(E),o=-u*E*O,l=y*E*O;var _=this.array;_[G++]=v,_[G++]=x,_[G++]=-o,_[G++]=-l,_[G++]=D,_[G++]=m,_[G++]=j}},{key:"setUniforms",value:function(j,G){var{gl:B,uniformLocations:M}=G,$=M.u_matrix,w=M.u_sizeRatio,O=M.u_correctionRatio,D=M.u_minEdgeThickness,I=M.u_lengthToThicknessRatio,P=M.u_widenessToThicknessRatio;B.uniformMatrix3fv($,!1,j.matrix),B.uniform1f(w,j.sizeRatio),B.uniform1f(O,j.correctionRatio),B.uniform1f(D,j.minEdgeThickness),B.uniform1f(I,W.lengthToThicknessRatio),B.uniform1f(P,W.widenessToThicknessRatio)}}])}(vQ)}var $9=DJ();var G7=\`
precision mediump float;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);
`
