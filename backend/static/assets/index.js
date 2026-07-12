(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))n(a);new MutationObserver(a=>{for(const r of a)if(r.type==="childList")for(const s of r.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function i(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?r.credentials="include":a.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(a){if(a.ep)return;a.ep=!0;const r=i(a);fetch(a.href,r)}})();const S={userCities:[],nominatimCache:{},async searchCities(e,t=5){if(!e||e.trim().length<2)return[];const i=`${e.toLowerCase()}_${t}`;if(this.nominatimCache[i])return this.nominatimCache[i];try{const n=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(e)}&format=json&limit=${t}`);if(!n.ok)throw new Error(`HTTP ${n.status}`);const r=(await n.json()).map(s=>({name:s.name||s.display_name.split(",")[0],displayName:s.display_name,latitude:parseFloat(s.lat),longitude:parseFloat(s.lon),osmType:s.osm_type,osmId:s.osm_id,boundingBox:s.boundingbox,type:s.type}));return this.nominatimCache[i]=r,r}catch(n){return console.error("[cities] Nominatim search failed:",n),[]}},async getCityFromCoordinates(e,t){var n,a,r;const i=`reverse_${e}_${t}`;if(this.nominatimCache[i])return this.nominatimCache[i];try{const s=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e}&lon=${t}`);if(!s.ok)throw new Error(`HTTP ${s.status}`);const o=await s.json(),l={name:o.name||((n=o.address)==null?void 0:n.city)||((a=o.address)==null?void 0:a.town)||"Unknown",displayName:o.display_name,latitude:parseFloat(o.lat),longitude:parseFloat(o.lon),country:((r=o.address)==null?void 0:r.country)||""};return this.nominatimCache[i]=l,l}catch(s){return console.error("[cities] Reverse geocoding failed:",s),null}},addCity(e){return!this.userCities.some(i=>i.latitude===e.latitude&&i.longitude===e.longitude)&&this.userCities.length<50?(this.userCities.push({...e,id:`${e.latitude}_${e.longitude}`,addedAt:new Date().toISOString()}),!0):!1},removeCity(e){this.userCities=this.userCities.filter(t=>t.id!==e)},getAllCities(){return this.userCities},clearAllCities(){this.userCities=[]},exportToJSON(){return JSON.stringify(this.userCities)},importFromJSON(e){try{return this.userCities=JSON.parse(e),!0}catch(t){return console.error("[cities] Import failed:",t),!1}},saveToDisk(e="wiaas_cities"){try{return localStorage.setItem(e,this.exportToJSON()),!0}catch(t){return console.error("[cities] Save to disk failed:",t),!1}},loadFromDisk(e="wiaas_cities"){try{const t=localStorage.getItem(e);return t?this.importFromJSON(t):!1}catch(t){return console.error("[cities] Load from disk failed:",t),!1}}};let C="pakistan_punjab";window._activeRegionKey=C;function Re(e){C=e,window._activeRegionKey=e,window._latestGridPredictions=null,window._latestGridAge=null}const We={pakistan_punjab:"Punjab Region, Pakistan",togo_maritime:"Maritime Region, Togo",france_paris:"Paris, France",spain_andalusia:"Andalusia, Spain",germany_bavaria:"Bavaria, Germany",uk_london:"Greater London, UK",italy_sicily:"Sicily, Italy",usa_california_central_valley:"Central Valley, California",usa_texas_houston:"Houston, Texas",brazil_cerrado:"Cerrado Savannah, Brazil",canada_alberta:"Alberta Plains, Canada",argentina_pampas:"The Pampas, Argentina"},je={pakistan_punjab:5,togo_maritime:0,france_paris:2,spain_andalusia:2,germany_bavaria:2,uk_london:1,italy_sicily:2,usa_california_central_valley:-7,usa_texas_houston:-5,brazil_cerrado:-3,canada_alberta:-6,argentina_pampas:-3};let ne=["pakistan_punjab","togo_maritime","france_paris","spain_andalusia","germany_bavaria","uk_london","italy_sicily","usa_california_central_valley","usa_texas_houston","brazil_cerrado","canada_alberta","argentina_pampas"],ye={...We},Pe={...je};function ze(e){e.id||(e.id=`city_${e.latitude}_${e.longitude}`),ne.includes(e.id)||(ne.push(e.id),ye[e.id]=e.displayName||e.name,Pe[e.id]=0)}function De(){S.getAllCities().forEach(e=>ze(e))}const te={};let ie=!0,q=!1,J=!1;function Ue(e){ie=e}function qe(e){q=e}function Je(e){J=e}let ve="analytics";function Ce(e){ve=e}let Q="assistant";function Ye(e){Q=e}const Xe={pakistan_punjab:{lat:31.17,lon:72.7},togo_maritime:{lat:6.13,lon:1.22},france_paris:{lat:48.85,lon:2.35},spain_andalusia:{lat:37.38,lon:-5.98},germany_bavaria:{lat:48.79,lon:11.49},uk_london:{lat:51.5,lon:-.12},italy_sicily:{lat:37.6,lon:14.01},usa_california_central_valley:{lat:36.77,lon:-119.41},usa_texas_houston:{lat:29.76,lon:-95.36},brazil_cerrado:{lat:-14.23,lon:-51.92},canada_alberta:{lat:53.93,lon:-116.57},argentina_pampas:{lat:-34.6,lon:-58.38}},j=1.6;function He(e,t,i=j){const n=(90-e)*(Math.PI/180),a=(t+180)*(Math.PI/180);return new THREE.Vector3(-i*Math.cos(a)*Math.sin(n),i*Math.cos(n),i*Math.sin(a)*Math.sin(n))}const Ke=`
    varying vec2 vUv;
    varying vec3 vLocalPosition;
    void main() {
        vUv = uv;
        vLocalPosition = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,Ze=`
    uniform sampler2D specularMap;
    uniform vec3  regionPos[12];
    uniform float regionTemp[12];
    varying vec2  vUv;
    varying vec3  vLocalPosition;

    void main() {
        float spec = texture2D(specularMap, vUv).r;
        if (spec > 0.05) {
            gl_FragColor = vec4(0.04, 0.04, 0.06, 1.0);
        } else {
            vec3  baseLandColor = vec3(0.12, 0.12, 0.15);
            float maxInfluence  = 0.0;
            float targetTemp    = 0.5;
            for (int i = 0; i < 12; i++) {
                vec3  rp   = normalize(regionPos[i]);
                float dist = distance(vLocalPosition, rp);
                if (dist < 0.35) {
                    float influence = (0.35 - dist) / 0.35;
                    influence = influence * influence;
                    if (influence > maxInfluence) {
                        maxInfluence = influence;
                        targetTemp   = regionTemp[i];
                    }
                }
            }
            if (maxInfluence > 0.0) {
                vec3 thermalColor;
                if      (targetTemp < 0.22) thermalColor = mix(vec3(0.00,0.15,0.75), vec3(0.00,0.80,0.75), targetTemp / 0.22);
                else if (targetTemp < 0.45) thermalColor = mix(vec3(0.00,0.80,0.75), vec3(0.00,0.80,0.15), (targetTemp-0.22)/0.23);
                else if (targetTemp < 0.68) thermalColor = mix(vec3(0.00,0.80,0.15), vec3(0.95,0.85,0.00), (targetTemp-0.45)/0.23);
                else if (targetTemp < 0.85) thermalColor = mix(vec3(0.95,0.85,0.00), vec3(0.95,0.42,0.00), (targetTemp-0.68)/0.17);
                else                        thermalColor = mix(vec3(0.95,0.42,0.00), vec3(0.85,0.02,0.02), (targetTemp-0.85)/0.15);
                gl_FragColor = vec4(mix(baseLandColor, thermalColor, maxInfluence), 1.0);
            } else {
                gl_FragColor = vec4(baseLandColor, 1.0);
            }
        }
    }
`,Qe=`
    varying vec2 vUv;
    varying vec3 vNormalW;
    void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,et=`
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform sampler2D specularMap;
    uniform vec3      sunDirection;
    varying vec2      vUv;
    varying vec3      vNormalW;

    void main() {
        vec3  normal  = normalize(vNormalW);
        float sunDot  = dot(normal, normalize(sunDirection));
        float dayMix  = smoothstep(-0.18, 0.15, sunDot);

        vec3  dayColor   = texture2D(dayTexture, vUv).rgb;
        vec3  nightColor = texture2D(nightTexture, vUv).rgb * 1.6;
        float waterMask  = texture2D(specularMap, vUv).r;

        // Soft ocean glint near the sub-solar point, lit side only.
        float glint = pow(max(sunDot, 0.0), 24.0) * waterMask * 0.85;

        vec3 litSide  = dayColor + vec3(glint);
        vec3 color    = mix(nightColor, litSide, dayMix);

        gl_FragColor = vec4(color, 1.0);
    }
`,tt=`
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,it=`
    varying vec3 vNormal;
    void main() {
        float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
        gl_FragColor = vec4(0.2, 0.55, 1.0, 1.0) * intensity;
    }
`;let R,N,W,H,F,pe,O,D=[],U=[],se=[],K,Z,P=4.5;const Me=2.3,Le=8.5;function Fe(e){const i=document.createElement("canvas");i.width=i.height=128;const n=i.getContext("2d"),a=i.width/2,r=n.createRadialGradient(a,a,0,a,a,a);r.addColorStop(0,`rgba(${e}, 1)`),r.addColorStop(.22,`rgba(${e}, 0.95)`),r.addColorStop(.55,`rgba(${e}, 0.28)`),r.addColorStop(1,`rgba(${e}, 0)`),n.fillStyle=r,n.fillRect(0,0,128,128);const s=new THREE.CanvasTexture(i);return s.needsUpdate=!0,s}function Ae(e,t,i,n,a){const r=new THREE.BufferGeometry,s=new Float32Array(e*3);for(let p=0;p<e;p++){const v=Math.random(),g=Math.random(),x=v*2*Math.PI,_=Math.acos(2*g-1),u=t+Math.random()*(i-t);s[p*3]=u*Math.sin(_)*Math.cos(x),s[p*3+1]=u*Math.sin(_)*Math.sin(x),s[p*3+2]=u*Math.cos(_)}r.setAttribute("position",new THREE.BufferAttribute(s,3));const o=Fe("255, 255, 255"),l=new THREE.PointsMaterial({color:n,size:a,map:o,transparent:!0,blending:THREE.AdditiveBlending,depthWrite:!1});return new THREE.Points(r,l)}function at(){const e=document.getElementById("globe-container"),t=e.clientWidth,i=e.clientHeight;R=new THREE.Scene,R.background=null,N=new THREE.PerspectiveCamera(45,t/i,.1,1e3),N.position.z=P,W=new THREE.WebGLRenderer({antialias:!0,alpha:!0}),W.setSize(t,i),W.setPixelRatio(Math.min(2,window.devicePixelRatio)),e.appendChild(W.domElement),e.style.cursor="grab";const n=new THREE.Vector3(5,3,5),a=new THREE.DirectionalLight(16777215,1.6);a.position.copy(n),R.add(a),R.add(new THREE.AmbientLight(1122867,.35));const r=new THREE.TextureLoader,s=r.load("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"),o=r.load("https://unpkg.com/three-globe/example/img/earth-night.jpg"),l=r.load("https://unpkg.com/three-globe/example/img/earth-water.png"),p=r.load("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png"),v={specularMap:{value:l},regionPos:{value:new Float32Array(36)},regionTemp:{value:new Float32Array(12)}};O=new THREE.ShaderMaterial({uniforms:v,vertexShader:Ke,fragmentShader:Ze,transparent:!0,opacity:.95}),pe=new THREE.ShaderMaterial({uniforms:{dayTexture:{value:s},nightTexture:{value:o},specularMap:{value:l},sunDirection:{value:n.clone().normalize()}},vertexShader:Qe,fragmentShader:et}),H=new THREE.Mesh(new THREE.SphereGeometry(j,96,96),ie?O:pe),R.add(H);const g=new THREE.Mesh(new THREE.SphereGeometry(j*1.016,64,64),new THREE.MeshPhongMaterial({map:p,alphaMap:p,transparent:!0,opacity:.38,depthWrite:!1}));R.add(g),H.userData.cloudSphere=g,R.add(new THREE.Mesh(new THREE.SphereGeometry(j*1.05,64,64),new THREE.ShaderMaterial({vertexShader:tt,fragmentShader:it,blending:THREE.AdditiveBlending,side:THREE.BackSide,transparent:!0}))),F=new THREE.Group,H.add(F),V(),K=Ae(400,15,30,8246268,.16),Z=Ae(800,35,60,16777215,.08),R.add(K),R.add(Z);let x=!1,_={x:0,y:0},u={x:0,y:0};e.addEventListener("mousedown",d=>{x=!0,_={x:d.clientX,y:d.clientY},e.style.cursor="grabbing"}),e.addEventListener("mousemove",d=>{x&&(u.y+=(d.clientX-_.x)*.005,u.x+=(d.clientY-_.y)*.005,u.x=Math.max(-Math.PI/3,Math.min(Math.PI/3,u.x)),_={x:d.clientX,y:d.clientY})}),window.addEventListener("mouseup",()=>{x=!1,e.style.cursor="grab"}),e.addEventListener("wheel",d=>{d.preventDefault(),P+=d.deltaY*.0022*P,P=Math.max(Me,Math.min(Le,P)),N.position.z=P},{passive:!1});let w=null,M=P;function T(d){const f=d[0].clientX-d[1].clientX,I=d[0].clientY-d[1].clientY;return Math.sqrt(f*f+I*I)}e.addEventListener("touchstart",d=>{d.touches.length===2?(w=T(d.touches),M=P):d.touches.length===1&&(x=!0,_={x:d.touches[0].clientX,y:d.touches[0].clientY})},{passive:!0}),e.addEventListener("touchmove",d=>{if(d.touches.length===2&&w){const f=T(d.touches),I=w/f;P=Math.max(Me,Math.min(Le,M*I)),N.position.z=P}else if(d.touches.length===1&&x){const f=d.touches[0];u.y+=(f.clientX-_.x)*.005,u.x+=(f.clientY-_.y)*.005,u.x=Math.max(-Math.PI/3,Math.min(Math.PI/3,u.x)),_={x:f.clientX,y:f.clientY}}},{passive:!0}),e.addEventListener("touchend",()=>{x=!1,w=null});let E=0,A=0;function L(){if(requestAnimationFrame(L),document.hidden)return;A+=.05,E+=.0012,H.rotation.y=E+u.y,H.rotation.x=u.x;const d=H.userData.cloudSphere;d&&(d.rotation.y=E*1.08+u.y,d.rotation.x=u.x),K&&(K.rotation.y=E*.08+u.y*.12,K.rotation.x=u.x*.12),Z&&(Z.rotation.y=E*.02+u.y*.04,Z.rotation.x=u.x*.04),J&&U.length>0&&U.forEach((f,I)=>{const b=1+Math.abs(Math.sin(A+I))*.8;f.scale.set(b,b,1)}),q&&D.length>0&&D.forEach((f,I)=>{const b=.8+Math.sin(A*1.5+I)*.2;f.setLength(.35*b,.08*b,.04*b)}),se.length>0&&se.forEach((f,I)=>{const b=1+Math.sin(A*2+I*1.3)*.18;f.scale.set(f.userData.baseScale*b,f.userData.baseScale*b,1)}),document.getElementById("globe-popup-overlay"),W.render(R,N)}L(),window.addEventListener("resize",()=>{const d=e.clientWidth,f=e.clientHeight;N.aspect=d/f,N.updateProjectionMatrix(),W.setSize(d,f)})}async function V(e=[]){D.forEach(n=>F.remove(n)),U.forEach(n=>F.remove(n)),F.clear(),D=[],U=[],se=[];const t=new Float32Array(36),i=new Float32Array(12);ne.forEach((n,a)=>{const r=te[n],s=Xe[n];if(!s)return;let o=20,l=10,p=0,v=50;r&&(o=r.telemetry.temperature_celsius,l=r.telemetry.wind_speed_kmh,p=r.telemetry.wind_direction_degrees,v=r.telemetry.humidity_percentage);const g=He(s.lat,s.lon,j);t[a*3]=g.x,t[a*3+1]=g.y,t[a*3+2]=g.z,i[a]=Math.max(0,Math.min(1,(o+5)/50));const x=g.clone().normalize(),_=new THREE.Vector3(0,1,0).projectOnPlane(x).normalize(),u=x.clone().cross(new THREE.Vector3(0,1,0)).normalize(),w=p*Math.PI/180,M=_.clone().multiplyScalar(Math.cos(w)).add(u.clone().multiplyScalar(Math.sin(w))).normalize(),T=new THREE.ArrowHelper(M,g,.15+l/60*.35,3718648,.08,.04);T.visible=q,F.add(T),D.push(T);const E=new THREE.Mesh(new THREE.RingGeometry(.08,.11,16),new THREE.MeshBasicMaterial({color:58879,side:THREE.DoubleSide,transparent:!0,opacity:v/100*.8}));E.position.copy(g),E.lookAt(0,0,0),E.visible=J&&v>60,F.add(E),U.push(E)}),e&&e.length>0&&e.forEach((n,a)=>{const r=nt(n,a);F.add(r),se.push(r)}),O&&O.uniforms&&(O.uniforms.regionPos.value=t,O.uniforms.regionTemp.value=i)}function nt(e,t){const i=["255, 107, 107","78, 205, 196","255, 230, 109","149, 225, 211","255, 138, 163","133, 220, 176"],n=i[t%i.length],a=new THREE.SpriteMaterial({map:Fe(n),transparent:!0,depthWrite:!1,blending:THREE.AdditiveBlending}),r=new THREE.Sprite(a),s=.11;return r.scale.set(s,s,1),r.position.copy(He(e.latitude,e.longitude,j*1.008)),r.userData={city:e,baseScale:s,createdAt:Date.now()},r}function st(){Ue(!ie),H&&(H.material=ie?O:pe,H.material.needsUpdate=!0)}function rt(){qe(!q),D.forEach(e=>{e.visible=q})}function ot(){Je(!J),U.forEach(e=>{e.visible=J})}let z=null,ae=null,G=null;function lt(){const e=document.getElementById("radarChart").getContext("2d");z=new Chart(e,{type:"radar",data:{labels:["Transpiration","NDVI Index","Soil Moisture","Canopy Cover","Nitrogen Level"],datasets:[{label:"Index Value",data:[.72,.82,.65,.55,.7],backgroundColor:"rgba(16, 185, 129, 0.15)",borderColor:"#10b981",borderWidth:2,pointBackgroundColor:"#10b981",pointBorderColor:"#fff",pointHoverBackgroundColor:"#fff",pointHoverBorderColor:"#10b981"}]},options:{responsive:!0,maintainAspectRatio:!1,scales:{r:{angleLines:{color:"rgba(255, 255, 255, 0.08)"},grid:{color:"rgba(255, 255, 255, 0.08)"},pointLabels:{color:"#9090a0",font:{family:"Outfit",size:9}},ticks:{display:!1},suggestedMin:0,suggestedMax:1}},plugins:{legend:{display:!1}}}});const t=document.getElementById("vramChart").getContext("2d"),i=t.createLinearGradient(0,0,0,180);i.addColorStop(0,"rgba(56, 189, 248, 0.8)"),i.addColorStop(1,"rgba(56, 189, 248, 0.1)");const n=t.createLinearGradient(0,0,0,180);n.addColorStop(0,"rgba(0, 229, 255, 0.95)"),n.addColorStop(1,"rgba(0, 229, 255, 0.15)"),ae=new Chart(t,{type:"bar",data:{labels:["Agri-Agent","Grid-Agent","Logistics","Regulator","Base Swarm"],datasets:[{data:[32,28,42,18,40.5],backgroundColor:[i,i,n,i,n],borderColor:"#38bdf8",borderWidth:1.5,borderRadius:6,borderSkipped:!1}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{x:{grid:{display:!1},ticks:{color:"#9090a0",font:{family:"Outfit",size:9}}},y:{grid:{color:"rgba(255, 255, 255, 0.04)"},ticks:{color:"#9090a0",font:{family:"JetBrains Mono",size:9}},suggestedMax:50}},animation:{duration:800,easing:"easeOutQuart"}}});const a=document.getElementById("tempPowerChart").getContext("2d"),r=a.createLinearGradient(0,0,0,200);r.addColorStop(0,"rgba(56, 189, 248, 0.25)"),r.addColorStop(1,"rgba(56, 189, 248, 0.0)");const s=a.createLinearGradient(0,0,0,200);s.addColorStop(0,"rgba(239, 68, 68, 0.18)"),s.addColorStop(1,"rgba(239, 68, 68, 0.0)"),G=new Chart(a,{type:"line",data:{labels:["10s ago","8s ago","6s ago","4s ago","2s ago","Now"],datasets:[{label:"Power Draw (W)",data:[610,620,605,630,642,656],borderColor:"#38bdf8",backgroundColor:r,fill:!0,borderWidth:2,tension:.35,pointBackgroundColor:"#38bdf8",pointBorderColor:"rgba(255,255,255,0.7)",pointRadius:4,pointHoverRadius:6,yAxisID:"yPower"},{label:"Core Temp (°C)",data:[72,73,72,74,75,75],borderColor:"#ef4444",backgroundColor:s,fill:!0,borderWidth:2,tension:.35,pointBackgroundColor:"#ef4444",pointBorderColor:"rgba(255,255,255,0.7)",pointRadius:4,pointHoverRadius:6,yAxisID:"yTemp"}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{x:{grid:{display:!1},ticks:{color:"#9090a0",font:{family:"Outfit",size:9}}},yPower:{type:"linear",position:"left",grid:{color:"rgba(255, 255, 255, 0.04)"},ticks:{color:"#38bdf8",font:{family:"JetBrains Mono",size:9}}},yTemp:{type:"linear",position:"right",grid:{display:!1},ticks:{color:"#ef4444",font:{family:"JetBrains Mono",size:9}}}},animation:{duration:800,easing:"easeOutQuart"}}})}function ct(e,t){z&&(z.data.datasets[0].data=e,t>.7?(z.data.datasets[0].borderColor="#10b981",z.data.datasets[0].backgroundColor="rgba(16, 185, 129, 0.15)"):t>.5?(z.data.datasets[0].borderColor="#f59e0b",z.data.datasets[0].backgroundColor="rgba(245, 158, 11, 0.15)"):(z.data.datasets[0].borderColor="#ef4444",z.data.datasets[0].backgroundColor="rgba(239, 68, 68, 0.15)"),z.update())}function dt(e,t){G&&(G.data.datasets[0].data.shift(),G.data.datasets[0].data.push(e),G.data.datasets[1].data.shift(),G.data.datasets[1].data.push(t),G.update("active"))}function pt(){if(!ae)return;const t=[32,28,42,18,40.5].map(i=>{const n=(Math.random()-.5)*4;return Math.max(5,Math.min(80,parseFloat((i+n).toFixed(1))))});ae.data.datasets[0].data=t,ae.update("active")}async function he(e){try{const t=ye[e]||"",i=t?`/analytics/${e}?name=${encodeURIComponent(t)}`:`/analytics/${e}`,n=await fetch(i);if(!n.ok)throw new Error(`HTTP ${n.status}`);return await n.json()}catch(t){return console.error(`[api] fetchRegionAnalytics(${e}) failed:`,t),null}}async function mt(e){const t=new Map;return await Promise.all(e.map(async i=>{const n=await he(i);n&&t.set(i,n)})),t}async function Ne(e,t){try{const i=await fetch(`/analytics/${e}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:t})});if(!i.ok)throw new Error(`HTTP ${i.status}`);return await i.json()}catch(i){return console.error(`[api] sendChatSimulation(${e}) failed:`,i),null}}async function gt(e){try{let t=sessionStorage.getItem("crisislens_session_id");t||(t="session-"+Math.random().toString(36).substring(2,15),sessionStorage.setItem("crisislens_session_id",t));const i=await fetch("/analytics/crisislens/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:e,session_id:t,user_id:"user-123"})});if(!i.ok)throw new Error(`HTTP ${i.status}`);return await i.json()}catch(t){return console.error("[api] sendCrisisLensChat failed:",t),null}}let m=null,Se=!1,oe=null;async function ut(e){try{const t=await fetch(`/analytics/${e}/grid-predictions`);if(!t.ok)return;const i=await t.json();if(i.status!=="ready")return;window._latestGridPredictions=i.predictions,window._latestGridAge=i.age_seconds,xe(i.predictions,i.age_seconds)}catch{}}function xe(e,t){if(!e)return;const i=document.getElementById("ai-peak-blackout-risk-val");i&&e.peak_blackout_risk_pct!==null&&(i.textContent=`${e.peak_blackout_risk_pct.toFixed(2)}%`);const n=document.getElementById("ai-peak-blackout-time-val");n&&e.peak_blackout_time!==null&&(n.textContent=e.peak_blackout_time);const a=document.getElementById("ai-grid-capacity-val");a&&e.grid_available_capacity_mw!==null&&(a.textContent=`${e.grid_available_capacity_mw.toFixed(2)} MW`);const r=document.getElementById("ai-grid-surge-val");r&&e.grid_demand_surge_pct!==null&&(r.textContent=`+${e.grid_demand_surge_pct.toFixed(2)}%`);const s=document.getElementById("ai-grid-status-badge");s&&e.grid_status&&(s.textContent=e.grid_status,s.className=`kpi-status ${e.grid_status==="STABLE"?"green":e.grid_status==="WARNING"?"yellow":"red"}`);const o=document.getElementById("ai-grid-summary-text");o&&e.ai_grid_summary&&(o.textContent=e.ai_grid_summary,o.style.fontStyle="normal",o.style.color="var(--text-primary)");const l=document.getElementById("grid-verdict-text");l&&e.ai_grid_summary&&(l.textContent=e.ai_grid_summary,l.style.fontStyle="normal",l.style.color="var(--text-primary)");const p=document.getElementById("grid-ai-status-badge");p&&e.grid_status&&(p.textContent=e.grid_status,p.className=`kpi-status ${e.grid_status==="STABLE"?"green":e.grid_status==="WARNING"?"yellow":"red"}`);const v=document.getElementById("grid-peak-risk-val");v&&e.peak_blackout_risk_pct!==null&&(v.textContent=`${e.peak_blackout_risk_pct.toFixed(2)}%`);const g=document.getElementById("grid-peak-time-val");g&&e.peak_blackout_time!==null&&(g.textContent=e.peak_blackout_time);const x=document.getElementById("grid-peak-risk-val-row");x&&e.peak_blackout_risk_pct!==null&&(x.textContent=`${e.peak_blackout_risk_pct.toFixed(2)}%`);const _=document.getElementById("grid-peak-time-val-row");_&&e.peak_blackout_time!==null&&(_.textContent=e.peak_blackout_time);const u=document.getElementById("ticker-blackout-risk"),w=document.getElementById("ticker-blackout-bar");if(u&&e.peak_blackout_risk_pct!==null){u.textContent=`${e.peak_blackout_risk_pct.toFixed(2)}%`;const L=e.peak_blackout_risk_pct>60?"red":e.peak_blackout_risk_pct>25?"yellow":"green";u.style.color=`var(--${L}-accent)`,w&&(w.style.width=`${Math.min(e.peak_blackout_risk_pct,100)}%`,w.style.background=`var(--${L}-accent)`)}const M=document.getElementById("ticker-grid-capacity-val");M&&e.grid_available_capacity_mw!==null&&(M.textContent=`${e.grid_available_capacity_mw.toFixed(2)} MW`);const T=document.getElementById("ticker-grid-surge-val");T&&e.grid_demand_surge_pct!==null&&(T.textContent=`+${e.grid_demand_surge_pct.toFixed(2)}%`);const E=document.getElementById("ticker-thermal-overhead-val");E&&e.thermal_overhead_pct!==null&&(E.textContent=`+${e.thermal_overhead_pct.toFixed(2)}%`);const A=L=>{const d=document.getElementById(L);if(d&&t!==null){const f=Math.round(t);d.textContent=f<60?`${f}s ago`:`${Math.round(f/60)}m ago`}};A("ai-grid-prediction-age"),A("grid-ai-age")}function ft(e){oe&&clearInterval(oe),window._gridCountdownTimer&&clearInterval(window._gridCountdownTimer);let t=60;function i(){const a=document.getElementById("ai-grid-refresh-countdown-left"),r=document.getElementById("ai-grid-refresh-countdown-right"),s=o=>{if(o)if(t<=0)o.textContent="Refreshing…",o.style.color="var(--yellow-accent)";else{const l=Math.floor(t/60),p=t%60;o.textContent=`${l}:${String(p).padStart(2,"0")}`,o.style.color=t<=10?"var(--yellow-accent)":"var(--text-secondary)"}};s(a),s(r),t--}async function n(){t=0,i(),await ut(e),t=60}n(),oe=setInterval(n,6e4),i(),window._gridCountdownTimer=setInterval(i,1e3)}function me(e){const t=document.getElementById("agent-grid-intelligence-panel");t&&(t.className="agent-grid-monitor-box",t.style.background="rgba(13, 13, 18, 0.95)",t.style.border="1px solid rgba(56, 189, 248, 0.2)",t.style.borderTop="1px solid rgba(56, 189, 248, 0.4)",t.style.borderRadius="12px",t.style.padding="16px",t.style.marginBottom="16px",t.style.boxShadow="0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",(e.ledger.grid_available_capacity_mw*.15).toFixed(2),(e.ledger.grid_available_capacity_mw*.05).toFixed(2),(e.ledger.grid_available_capacity_mw*.65).toFixed(2),t.innerHTML=`
        <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent-color); margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="cpu" style="width: 16px; height: 16px;"></i> AI MODEL PREDICTIONS: GLOBAL MONITOR
        </div>

        <!-- AI Model Verdict Box -->
        <div style="background: rgba(56, 189, 248, 0.04); border: 1px solid rgba(56, 189, 248, 0.12); border-radius: 8px; padding: 10px; font-size: 0.75rem; line-height: 1.35; margin-bottom: 12px; color: var(--text-primary);">
            <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px;">Grid Agent Verdict</div>
            <span id="ai-grid-summary-text" style="color: var(--text-secondary); font-style: italic;">Fetching from n8n AI Agent…</span>
            <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                <span class="kpi-status green" id="ai-grid-status-badge">PENDING</span>
                <span style="color: var(--text-secondary); font-size: 0.65rem;">Updated: <span id="ai-grid-prediction-age">—</span></span>
            </div>
            <div style="margin-top: 5px; display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--text-secondary);">
                <i data-lucide="refresh-cw" style="width: 10px; height: 10px; opacity: 0.6;"></i>
                Data refreshes in <span id="ai-grid-refresh-countdown-right" style="font-family: var(--font-data); font-weight: 700; color: var(--text-secondary); margin-left: 3px;">…</span>
            </div>
        </div>


        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.75rem;">

            <!-- Power Grid: AI Values -->
            <div style="font-weight: 600; color: var(--accent-color); font-size: 0.7rem; text-transform: uppercase; margin-bottom: 2px;">Power Grid Model (AI)</div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Peak Blackout Risk</span>
                <span id="ai-peak-blackout-risk-val" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">—</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Peak Risk Time</span>
                <span id="ai-peak-blackout-time-val" style="font-family: var(--font-data); font-weight: 700; color: var(--yellow-accent);">—</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Available Grid Capacity</span>
                <span id="ai-grid-capacity-val" style="font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">—</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                <span style="color: var(--text-secondary);">Grid Demand Surge</span>
                <span id="ai-grid-surge-val" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">—</span>
            </div>

            <!-- Agriculture Model Section -->
            <div style="font-weight: 600; color: var(--accent-color); font-size: 0.7rem; text-transform: uppercase; margin-top: 4px;">Agriculture Physics Model</div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Sprinkler Efficiency</span>
                <span id="right-ticker-sprinkler-eff" style="font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">${e.ledger.water_irrigation_efficiency_pct.toFixed(2)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Reservoir Evap Loss</span>
                <span id="right-ticker-evap-loss" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">${e.ledger.water_surface_evap_loss_pct.toFixed(2)}%</span>
            </div>

            <!-- Logistics Model Section -->
            <div style="font-weight: 600; color: var(--accent-color); font-size: 0.7rem; text-transform: uppercase; margin-top: 4px;">Logistics &amp; Fuel Model</div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Thermal Fuel Burn Overhead</span>
                <span id="right-ticker-fuel-overhead" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">+${e.ledger.fuel_thermal_overhead_pct.toFixed(2)}%</span>
            </div>
        </div>
    `,lucide.createIcons(),(e.region_key||window._activeRegionKey)&&ft(e.region_key||window._activeRegionKey),window._latestGridPredictions&&xe(window._latestGridPredictions,window._latestGridAge))}function yt(){function e(){if(m){const i=Date.now()/1e3,n=Math.sin(i*7.3)*.02+Math.cos(i*13.7)*.005+(Math.random()-.5)*.001,a=Math.cos(i*5.1)*.05+(Math.random()-.5)*.002,r=Math.sin(i*9.2)*.04+(Math.random()-.5)*.001,s=Math.sin(i*3.4)*.003+(Math.random()-.5)*1e-4,o=Math.cos(i*4.2)*.1+(Math.random()-.5)*.005,l=Math.sin(i*2.1)*.5+(Math.random()-.5)*.05,p=document.getElementById("crop-health-value");if(p){const c=m.crop_health_ndvi,y=Math.sin(i*2.5)*1e-4+(Math.random()-.5)*1e-5;p.innerText=(c+y).toFixed(6)}const v=document.getElementById("soil-moisture-val");if(v){const c=m.soil_moisture_pct,y=Math.sin(i*1.8)*.02+(Math.random()-.5)*.002,$=c+y,X=$>35?"Optimal":$>20?"Adequate":"Critical Low";v.innerText=`${$.toFixed(5)}% (${X})`}const g=document.getElementById("irrigation-demand-val");if(g){const c=m.ledger.water_deliverable_m3/1e4,y=Math.cos(i*1.5)*.01+(Math.random()-.5)*5e-4;g.innerText=`${(c+y).toFixed(5)} m³/hectare`}const x=document.getElementById("water-stress-val");if(x){const c=m.water_stress_index,y=Math.sin(i*3.1)*.001+(Math.random()-.5)*1e-4,$=Math.max(0,c+y),X=$>.6?"Severe":$>.3?"Moderate":"Nominal";x.innerText=`${$.toFixed(6)} (${X})`}const _=document.getElementById("gross-reservoir-val");if(_){const c=m.ledger.water_gross_reservoir_m3,y=Math.sin(i*2.2)*50+(Math.random()-.5)*5;_.innerText=`${Math.round(c+y).toLocaleString()} m³`}const u=document.getElementById("deliverable-water-val");if(u){const c=m.ledger.water_deliverable_m3,y=Math.cos(i*1.9)*40+(Math.random()-.5)*4;u.innerText=`${Math.round(c+y).toLocaleString()} m³`}const w=document.getElementById("reservoir-evap-loss-val");if(w){const c=m.ledger.water_surface_evap_loss_pct,y=Math.sin(i*3.5)*.02+(Math.random()-.5)*.002;w.innerText=`${Math.max(0,c+y).toFixed(4)}%`}const M=document.getElementById("irrigation-viability-val"),T=document.getElementById("waste-penalty-val");if(M||T){const y=m.ledger.water_irrigation_efficiency_pct>=50;M&&(M.innerText=y?"Viable":"Not Recommended",M.className=`data-value ${y?"green":"red"}`),T&&(T.innerText=y?"Inactive":"Active",T.className=`data-value ${y?"green":"red"}`)}const E=document.getElementById("ticker-temp-val");if(E){const c=m.telemetry.temperature_celsius+n;E.innerText=`${c.toFixed(6)}°C`}const A=document.getElementById("ticker-wind-val");if(A){const c=Math.max(0,m.telemetry.wind_speed_kmh+r),y=(m.telemetry.wind_direction_degrees+i*10%360)%360;A.innerText=`${c.toFixed(5)} km/h @ ${y.toFixed(3)}°`}const L=document.getElementById("ticker-humidity-val");if(L){const c=Math.max(0,Math.min(100,m.telemetry.humidity_percentage+a));L.innerText=`${c.toFixed(5)}%`}const d=document.getElementById("ticker-vpd-val");if(d){const c=Math.max(0,m.climate_matrix.vapor_pressure_deficit_kpa+s);d.innerText=c.toFixed(6)}const f=document.getElementById("ticker-heat-index-val");if(f){const c=m.climate_matrix.heat_index_celsius+n;f.innerText=`${c.toFixed(6)}°C`}const I=document.getElementById("ticker-wet-bulb-val");if(I){const c=m.climate_matrix.wet_bulb_celsius+n;I.innerText=`${c.toFixed(6)}°C`}const b=document.getElementById("ticker-deviation-val");if(b){const c=m.climate_matrix.deviation_from_baseline_celsius+n;b.innerText=`${c>0?"+":""}${c.toFixed(6)}°C`}const k=document.getElementById("right-ticker-sprinkler-eff");if(k){const c=m.climate_matrix.vapor_pressure_deficit_kpa+s,$=1+.02*Math.max(0,m.telemetry.wind_speed_kmh+r),X=Math.min(.95,c*$*.08),Ve=Math.max(.05,1-X);k.innerText=`${(Ve*100).toFixed(2)}%`}const h=document.getElementById("right-ticker-evap-loss");if(h){const c=m.climate_matrix.vapor_pressure_deficit_kpa+s,y=Math.min(.3,c*.018)*100;h.innerText=`${y.toFixed(2)}%`}const B=document.getElementById("right-ticker-fuel-overhead");if(B){const c=Math.max(0,m.climate_matrix.deviation_from_baseline_celsius+n),y=Math.min(.4,c*.012)*100;B.innerText=`+${y.toFixed(2)}%`}const be=document.getElementById("ticker-fuel-val");if(be){const c=Math.max(0,m.ledger.fuel_available_liters+l);be.innerText=c.toLocaleString(void 0,{minimumFractionDigits:4,maximumFractionDigits:4})}const _e=document.getElementById("ticker-fuel-overhead-val");if(_e){const c=m.ledger.fuel_thermal_overhead_pct+o*.02;_e.innerText=`+${c.toFixed(5)}%`}const we=document.getElementById("bottom-agent-verdict");if(we){const y=(m.ledger.grid_demand_surge_pct+o*.05)/60*100;let $="";y>80?$="CRITICAL: Severe heat anomaly has spiked demand to critical ceilings. Cascading failure risk is extreme. Switch off non-essential agricultural feeders immediately.":y>40?$="WARNING: Moderate thermal surge active. Substation temperatures are elevated. Implement demand-response limits on heavy motors.":$="NORMAL: Grid frequency is stable. Supply capacity satisfies all active operational agent bids.",we.innerText=$}const Ee=document.getElementById("bottom-agent-blackout-prob");if(Ee){const y=(m.ledger.grid_demand_surge_pct+o*.05)/60*100;Ee.innerText=`${y.toFixed(4)}%`}const ke=document.getElementById("bottom-agent-capacity");if(ke){const c=Math.max(0,m.ledger.grid_available_capacity_mw+o);ke.innerText=`${c.toFixed(5)} MW`}const Ie=document.getElementById("bottom-agent-surge");if(Ie){const c=m.ledger.grid_demand_surge_pct+o*.05;Ie.innerText=`+${c.toFixed(5)}%`}const Te=document.getElementById("bottom-agent-efficiency");if(Te){const c=m.ledger.water_irrigation_efficiency_pct,y=Math.sin(i*4.1)*.02+(Math.random()-.5)*.002;Te.innerText=`${Math.max(0,Math.min(100,c+y)).toFixed(2)}%`}}requestAnimationFrame(e)}requestAnimationFrame(e)}function vt(e){m=e,Se||(Se=!0,yt());const t=document.getElementById("current-region-name");t&&(t.innerText=`${e.region_name} (${e.latitude.toFixed(2)}°, ${e.longitude.toFixed(2)}°) [${e.diurnal_cycle}] | Risk: ${e.risk_level} (Score: ${e.mission_criticality_score})`);const i=e.climate_matrix,n=e.telemetry,a=e.ledger,r=document.getElementById("crop-health-status");r.innerText=e.system_status.replace(/_/g," "),r.className="kpi-status",e.system_status==="HEALTHY"?r.classList.add("green"):e.system_status==="ADVISORY"?r.classList.add("yellow"):r.classList.add("red");const s=e.crop_health_ndvi;document.getElementById("crop-health-value").innerText=s.toFixed(2);const o=[Math.max(.1,.85-i.vapor_pressure_deficit_kpa*.15),parseFloat(s.toFixed(2)),parseFloat((e.soil_moisture_pct/50).toFixed(2)),Math.max(.2,.8-(.85-s)*.5),Math.max(.3,.9-i.deviation_from_baseline_celsius*.03)];ct(o,s);const l=e.soil_moisture_pct.toFixed(1),p=l>35?"Optimal":l>20?"Adequate":"Critical Low",v=document.getElementById("soil-moisture-val");v.innerText=`${l}% (${p})`,v.className=`data-value ${l<20?"red":l<35?"yellow":"green"}`,m.soil_moisture_base=parseFloat(l);const g=Math.round(a.water_deliverable_m3/1e4);document.getElementById("irrigation-demand-val").innerText=`${g} m³/hectare`;const x=Math.round(e.disease_risk_pct),_=x>30?"High":x>15?"Medium":"Low",u=document.getElementById("disease-risk-val");u.innerText=`${_} (${x}%)`,u.className=`data-value ${x>30?"red":x>15?"yellow":"green"}`;const w=e.water_stress_index.toFixed(2),M=w>.6?"Severe":w>.3?"Moderate":"Nominal",T=document.getElementById("water-stress-val");T.innerText=`${w} (${M})`,T.className=`data-value ${w>.6?"red":w>.3?"yellow":"green"}`;const E=document.getElementById("gross-reservoir-val");E&&(E.innerText=`${a.water_gross_reservoir_m3.toLocaleString()} m³`);const A=document.getElementById("deliverable-water-val");A&&(A.innerText=`${a.water_deliverable_m3.toLocaleString()} m³`);const L=document.getElementById("reservoir-evap-loss-val");L&&(L.innerText=`${a.water_surface_evap_loss_pct.toFixed(2)}%`,L.className=`data-value ${a.water_surface_evap_loss_pct>15?"red":a.water_surface_evap_loss_pct>5?"yellow":"green"}`);const d=document.getElementById("irrigation-viability-val");if(d){const b=a.water_irrigation_efficiency_pct>=50;d.innerText=b?"Viable":"Not Recommended",d.className=`data-value ${b?"green":"red"}`}const f=document.getElementById("waste-penalty-val");if(f){const b=a.water_irrigation_efficiency_pct<50;f.innerText=b?"Active":"Inactive",f.className=`data-value ${b?"red":"green"}`}let I="";if(e.system_status==="CRITICAL_ANOMALY"?I=`CRITICAL WARNING: Temperature exceeded baseline by ${i.deviation_from_baseline_celsius}°C. High vapor pressure deficit of ${i.vapor_pressure_deficit_kpa} kPa detected. Immediately switch to sub-surface drip irrigation to prevent evaporative loss.`:e.system_status==="WARNING_ANOMALY"?I="ADVISORY: Moderate thermal stress. Soil moisture levels are declining. Shift irrigation schedules to early morning hours to optimize absorption and protect canopy transpiration.":I="SYSTEM NORMAL: Atmospheric conditions match the regional baseline. Maintain standard automated irrigation scheduling and track crop indices.",document.getElementById("ai-recommendation-text").innerText=I,document.getElementById("system-notification-text").innerText=`Weather models processed for ${e.region_name}. System status matches ${e.system_status} with current temperature at ${n.temperature_celsius}°C. Risk Level: ${e.risk_level} (Criticality Score: ${e.mission_criticality_score}/100). Adjusting domain policies accordingly.`,ee&&!document.getElementById("general-info-panel").classList.contains("hidden")){ge(ee,e);const b=document.getElementById("agent-grid-intelligence-panel");b&&(ee==="grid"?(b.classList.remove("hidden"),me(e)):b.classList.add("hidden"))}}function ge(e,t){const i=document.getElementById("general-panel-title"),n=document.getElementById("general-panel-content"),a=document.getElementById("general-panel-icon");if(!i||!n||!a)return;let r="";if(e==="globe-analysis")i.innerText="Globe Analysis Layers",a.setAttribute("data-lucide","layers"),r=`
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.12); border-left: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div>
                        <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Thermographic Heatmap</h4>
                        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Continental surface anomalies</p>
                    </div>
                    <input type="checkbox" id="heatmap-toggle" ${ie?"checked":""} onchange="window.__wiaas.toggleHeatmap()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.12); border-left: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div>
                        <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Real-time Wind Flow</h4>
                        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Wind direction and speed vectors</p>
                    </div>
                    <input type="checkbox" id="wind-toggle" ${q?"checked":""} onchange="window.__wiaas.toggleWind()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.12); border-left: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div>
                        <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Precipitation &amp; Rain</h4>
                        <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Relative humidity pulse indicators</p>
                    </div>
                    <input type="checkbox" id="rain-toggle" ${J?"checked":""} onchange="window.__wiaas.togglePrecipitation()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                </div>
                <div style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Zone Signals</h4>
                    <ul class="data-grid">
                        <li class="data-row" style="padding: 10px 0;">
                            <span class="data-label" style="font-size: 0.8rem;">Current Temperature</span>
                            <span class="data-value" id="ticker-temp-val" style="font-size: 0.8rem;">${t.telemetry.temperature_celsius}°C</span>
                        </li>
                        <li class="data-row" style="padding: 10px 0;">
                            <span class="data-label" style="font-size: 0.8rem;">Wind Velocity</span>
                            <span class="data-value" id="ticker-wind-val" style="font-size: 0.8rem;">${t.telemetry.wind_speed_kmh} km/h @ ${t.telemetry.wind_direction_degrees}°</span>
                        </li>
                        <li class="data-row" style="padding: 10px 0;">
                            <span class="data-label" style="font-size: 0.8rem;">Relative Humidity</span>
                            <span class="data-value" id="ticker-humidity-val" style="font-size: 0.8rem;">${t.telemetry.humidity_percentage}%</span>
                        </li>
                    </ul>
                </div>
            </div>
        `;else if(e==="region")i.innerText="Select Monitoring Region",a.setAttribute("data-lucide","globe"),r=`
            <div class="region-select-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                ${Object.entries(ye).map(([s,o])=>`
                    <button class="region-select-btn ${s===C?"active":""}"
                            onclick="window.__wiaas.selectActiveRegion('${s}')"
                            style="background: ${s===C?"rgba(56, 189, 248, 0.08)":"rgba(255, 255, 255, 0.02)"};
                                   border: 1px solid ${s===C?"rgba(56, 189, 248, 0.3)":"rgba(255, 255, 255, 0.05)"};
                                   border-top: 1px solid ${s===C?"rgba(56, 189, 248, 0.5)":"rgba(255, 255, 255, 0.12)"};
                                   border-left: 1px solid ${s===C?"rgba(56, 189, 248, 0.4)":"rgba(255, 255, 255, 0.08)"};
                                   color: ${s===C?"var(--text-primary)":"var(--text-secondary)"};
                                   text-align: left; padding: 12px 16px; border-radius: 8px; cursor: pointer;
                                   font-family: var(--font-ui); font-size: 0.85rem; font-weight: 500; transition: all 0.2s;
                                   backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                                   box-shadow: ${s===C?"inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 12px rgba(56, 189, 248, 0.05)":"inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 4px 12px rgba(0, 0, 0, 0.15)"};">
                         ${o}
                    </button>
                `).join("")}
            </div>
        `;else if(e==="physics")i.innerText="Physics Intelligence",a.setAttribute("data-lucide","thermometer"),r=`
            <div class="kpi-section">
                <div class="kpi-header">Vapor Pressure Deficit</div>
                <div class="kpi-value-row">
                    <span class="kpi-value" id="ticker-vpd-val">${t.climate_matrix.vapor_pressure_deficit_kpa}</span>
                    <span class="kpi-unit">kPa</span>
                </div>
            </div>
            <ul class="data-grid" style="margin-top: 15px;">
                <li class="data-row">
                    <span class="data-label">Heat Index</span>
                    <span class="data-value" id="ticker-heat-index-val">${t.climate_matrix.heat_index_celsius}°C</span>
                </li>
                <li class="data-row">
                    <span class="data-label">Wet-Bulb Temperature</span>
                    <span class="data-value" id="ticker-wet-bulb-val">${t.climate_matrix.wet_bulb_celsius}°C</span>
                </li>
                <li class="data-row">
                    <span class="data-label">Deviation from Baseline</span>
                    <span class="data-value ${t.climate_matrix.deviation_from_baseline_celsius>0?"red":"green"}" id="ticker-deviation-val">
                        +${t.climate_matrix.deviation_from_baseline_celsius}°C
                    </span>
                </li>
            </ul>
        `;else if(e==="grid")i.innerText="Power Grid Status",a.setAttribute("data-lucide","zap"),r=`
            <div style="display: flex; flex-direction: column; gap: 16px;">

                <!-- AI Verdict Box -->
                <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 8px; padding: 12px; font-size: 0.75rem; color: var(--text-primary); line-height: 1.4;">
                    <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="cpu" style="width: 14px; height: 14px;"></i> AI GRID AGENT VERDICT
                    </div>
                    <span id="grid-verdict-text" style="color: var(--text-secondary); font-style: italic;">Fetching from n8n AI Agent…</span>
                    <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                        <span class="kpi-status green" id="grid-ai-status-badge">PENDING</span>
                        <span style="color: var(--text-secondary); font-size: 0.65rem;">Updated: <span id="grid-ai-age">—</span></span>
                    </div>
                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--text-secondary);">
                        <i data-lucide="refresh-cw" style="width: 10px; height: 10px; opacity: 0.6;"></i>
                        Data refreshes in <span id="ai-grid-refresh-countdown-left" style="font-family: var(--font-data); font-weight: 700; margin-left: 3px;">…</span>
                    </div>
                </div>

                <!-- Peak Blackout Risk (AI) -->
                <div style="background: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; padding: 12px; font-size: 0.75rem; color: var(--text-primary); line-height: 1.4;">
                    <div style="font-weight: 700; color: var(--red-accent); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="trending-up" style="width: 14px; height: 14px;"></i> PEAK BLACKOUT RISK
                    </div>
                    <span>Predicted Peak Risk: <strong id="grid-peak-risk-val" style="color: var(--red-accent);">—</strong> at <strong id="grid-peak-time-val">—</strong> local runtime.</span>
                </div>

                <!-- GNN Blackout Risk KPI (AI) -->
                <div class="kpi-section" style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.01);">
                    <div class="kpi-header" style="font-size: 0.75rem; color: var(--text-secondary);">GNN Blackout Risk Probability (AI)</div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                        <span id="ticker-blackout-risk" style="font-family: var(--font-data); font-size: 1.25rem; font-weight: 700; color: var(--red-accent);">—</span>
                        <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                            <div id="ticker-blackout-bar" style="width: 0%; height: 100%; background: var(--red-accent); transition: width 0.8s ease;"></div>
                        </div>
                    </div>
                </div>

                <!-- Tickers (AI values) -->
                <ul class="data-grid">
                    <li class="data-row">
                        <span class="data-label">Peak Blackout Risk</span>
                        <span class="data-value red" id="grid-peak-risk-val-row">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Peak Risk Time</span>
                        <span class="data-value" id="grid-peak-time-val-row" style="color: var(--yellow-accent);">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Available Grid Capacity</span>
                        <span class="data-value green" id="ticker-grid-capacity-val">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Grid Demand Surge</span>
                        <span class="data-value red" id="ticker-grid-surge-val">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Thermal Overhead (AI)</span>
                        <span class="data-value red" id="ticker-thermal-overhead-val">—</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Physics Baseline Capacity</span>
                        <span class="data-value" style="opacity:0.5;">${t.ledger.grid_available_capacity_mw.toFixed(2)} MW</span>
                    </li>
                </ul>

            </div>
        `;else if(e==="logistics")i.innerText="Logistics Reserves",a.setAttribute("data-lucide","truck"),r=`
            <div class="kpi-section">
                <div class="kpi-header">Available Fuel Reserves</div>
                <div class="kpi-value-row">
                    <span class="kpi-value" id="ticker-fuel-val">${t.ledger.fuel_available_liters.toLocaleString()}</span>
                    <span class="kpi-unit">Liters</span>
                </div>
            </div>
            <ul class="data-grid" style="margin-top: 15px;">
                <li class="data-row">
                    <span class="data-label">Thermal Fuel Overhead</span>
                    <span class="data-value red" id="ticker-fuel-overhead-val">+${t.ledger.fuel_thermal_overhead_pct}%</span>
                </li>
            </ul>
        `;else if(e==="research")i.innerText="State Vector & Research",a.setAttribute("data-lucide","microscope"),r=`
            <div style="max-height: 650px; overflow-y: auto; padding-right: 5px;">
                ${bt(t.llm_state_vector)}
            </div>
        `;else if(e==="crisislens"){i.innerText=`CrisisLens Threat Analysis - ${t.region_name}`,a.setAttribute("data-lucide","shield-alert");const s=t.mission_criticality_score||0;let o="var(--green-accent)";s>75?o="var(--red-accent)":s>40&&(o="var(--yellow-accent)"),r=`
            <div style="display: flex; flex-direction: column; gap: 16px; max-height: 650px; overflow-y: auto; padding-right: 5px;">
                <!-- Threat Level & Criticality -->
                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 14px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 4px 12px rgba(0, 0, 0, 0.15);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase;">Crisis Severity</span>
                        <span class="kpi-status" style="background: ${o}20; color: ${o}; border: 1px solid ${o}40; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">${t.risk_level.toUpperCase()}</span>
                    </div>
                    <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 8px;">
                        <span style="font-family: var(--font-data); font-size: 1.8rem; font-weight: 700; color: ${o};">${s}</span>
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">/ 100 Criticality</span>
                    </div>
                    <div style="margin-top: 8px; font-size: 0.72rem; color: var(--text-secondary);">
                        System status: <strong style="color: ${o};">${t.system_status}</strong>
                    </div>
                </div>

                <!-- Climate Indicators -->
                <div>
                    <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Climate Risk Vectors</h4>
                    <ul class="data-grid">
                        <li class="data-row">
                            <span class="data-label">Vapor Pressure Deficit (VPD)</span>
                            <span class="data-value" style="color: var(--yellow-accent); font-weight: 600;">${t.climate_matrix.vapor_pressure_deficit_kpa} kPa</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Wet-Bulb Temperature</span>
                            <span class="data-value" style="color: var(--red-accent); font-weight: 600;">${t.climate_matrix.wet_bulb_celsius}°C</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Heat Index</span>
                            <span class="data-value">${t.climate_matrix.heat_index_celsius}°C</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Baseline Temp Deviation</span>
                            <span class="data-value ${t.climate_matrix.deviation_from_baseline_celsius>0?"red":"green"}">
                                +${t.climate_matrix.deviation_from_baseline_celsius}°C
                            </span>
                        </li>
                    </ul>
                </div>

                <!-- Resource Ledgers -->
                <div>
                    <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Resource Availability</h4>
                    <ul class="data-grid">
                        <li class="data-row">
                            <span class="data-label">Deliverable Water Volume</span>
                            <span class="data-value green">${t.ledger.water_deliverable_m3.toLocaleString()} m³</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Evaporative Rate Penalty</span>
                            <span class="data-value red">${t.ledger.water_surface_evap_loss_pct.toFixed(2)}%</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Grid Available Capacity</span>
                            <span class="data-value green">${t.ledger.grid_available_capacity_mw.toFixed(2)} MW</span>
                        </li>
                        <li class="data-row">
                            <span class="data-label">Fuel Reserves</span>
                            <span class="data-value green">${t.ledger.fuel_available_liters.toLocaleString()} L</span>
                        </li>
                    </ul>
                </div>

                <!-- Active Routing Directives -->
                <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 8px; padding: 12px; font-size: 0.7rem; line-height: 1.45;">
                    <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="shield-alert" style="width: 12px; height: 12px;"></i> CrisisLens Active Zones
                    </div>
                    <p style="margin: 0; color: var(--text-secondary);">Direct response routing enabled for <strong>Sylhet</strong>, <strong>Punjab</strong>, <strong>Paris</strong>, and all active telemetry zones.</p>
                </div>
            </div>
        `}n.innerHTML=r,lucide.createIcons(),e==="grid"&&window._latestGridPredictions&&xe(window._latestGridPredictions,window._latestGridAge)}let ee=null;async function ue(e){ee=e;const t=e;try{document.getElementById("agriculture-panel").classList.add("hidden"),document.getElementById("general-info-panel").classList.remove("hidden"),document.getElementById("left-sidebar").classList.add("visible");const i=te[C];if(i)ge(e,i);else{const r=document.getElementById("general-panel-content");r&&(r.innerHTML='<p style="color:var(--text-secondary);font-size:0.8rem;">Loading data…</p>')}const n=document.getElementById("agent-grid-intelligence-panel");n&&(e==="grid"?(n.classList.remove("hidden"),i&&me(i)):n.classList.add("hidden"));const a=await he(C);if(!a||ee!==t)return;te[C]=a,ge(e,a),e==="grid"&&n&&me(a)}catch(i){console.error("[ui] showGeneralInfoPanel failed:",i)}}function Be(){const e=Pe[C]??0,t=Date.now()+new Date().getTimezoneOffset()*6e4,n=new Date(t+36e5*e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}),a=document.getElementById("current-region-time");a&&(a.innerText=n)}function ht(){setInterval(()=>{const e=(80+Math.random()*5).toFixed(1),t=(158+Math.random()*4).toFixed(1),i=Math.round(4200+Math.random()*200).toLocaleString(),n=(8+Math.random()*.8).toFixed(1),a=Math.round(640+Math.random()*25),r=Math.round(73+Math.random()*3);document.getElementById("cpu-util-val").innerText=`${e}%`,document.getElementById("vram-usage-val").innerText=`${t} / 192 GB`,document.getElementById("inf-speed-val").innerText=`${i} T/s`,document.getElementById("latency-val").innerText=`${n} ms`,document.getElementById("power-draw-val").innerText=`${a} W`,dt(a,r),pt()},2e3)}function le(){const e=document.getElementById("bottom-panel-title"),t=document.getElementById("bottom-analytics-container"),i=document.getElementById("bottom-agents-container");!e||!t||!i||(ve==="analytics"?(e.innerText="ROCm Multi-Agent Inference Details",t.style.display="flex",i.classList.add("hidden")):(e.innerText="AI Agent Swarm Allocation & Predictions",t.style.display="none",i.classList.remove("hidden"),xt()))}function xt(){const e=document.getElementById("bottom-agents-container");if(!e)return;if(!m){e.innerHTML='<p style="color:var(--text-secondary);font-size:0.8rem;padding:12px;">Loading agent telemetry...</p>';return}const t=m.baselines?m.baselines.grid_capacity_mw:m.ledger.grid_available_capacity_mw/(1-m.ledger.grid_demand_surge_pct/100),i=m.ledger.grid_demand_surge_pct/60*100;let n="",a="green";i>80?(n="CRITICAL: Severe heat anomaly has spiked demand to critical ceilings. Cascading failure risk is extreme. Switch off non-essential agricultural feeders immediately.",a="red"):i>40?(n="WARNING: Moderate thermal surge active. Substation temperatures are elevated. Implement demand-response limits on heavy motors.",a="yellow"):n="NORMAL: Grid frequency is stable. Supply capacity satisfies all active operational agent bids.";const r=(t*.15).toFixed(2),s=(t*.05).toFixed(2),o=(t*.65).toFixed(2),l=m.ledger.grid_available_capacity_mw.toFixed(5),p=m.ledger.grid_demand_surge_pct.toFixed(5);e.innerHTML=`
        <div style="display: flex; gap: 24px; padding: 10px 0; width: 100%;">
            <!-- Verdict Box -->
            <div style="flex: 1.2; background: rgba(56, 189, 248, 0.04); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; height: 130px;">
                <div>
                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent-color); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="info" style="width: 16px; height: 16px;"></i> ACTIVE AGENT STATUS &amp; VERDICT
                    </div>
                    <p style="font-size: 0.75rem; line-height: 1.4; color: var(--text-primary);" id="bottom-agent-verdict">${n}</p>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary);">
                    GNN Blackout Risk Probability: <span id="bottom-agent-blackout-prob" style="font-family: var(--font-data); font-weight: 700; color: var(--${a}-accent);">${i.toFixed(4)}%</span>
                </div>
            </div>

            <!-- Agent Allocations -->
            <div style="flex: 1; background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 14px; height: 130px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Multi-Agent Bandwidth Allocation
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Agri-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600;">${r} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Logistics-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600;">${s} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Regulator-Agent Bid</span>
                        <span style="font-family: var(--font-data); font-weight: 600;">${o} MW</span>
                    </div>
                </div>
            </div>

            <!-- Telemetry Constraints -->
            <div style="flex: 1; background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 14px; height: 130px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Telemetry Constraints
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Available Grid Capacity</span>
                        <span id="bottom-agent-capacity" style="font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">${l} MW</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Active Demand Surge</span>
                        <span id="bottom-agent-surge" style="font-family: var(--font-data); font-weight: 700; color: var(--red-accent);">+${p}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-secondary);">Sprinkler Irrigation Efficiency</span>
                        <span id="bottom-agent-efficiency" style="font-family: var(--font-data); font-weight: 600; color: var(--green-accent);">${m.ledger.water_irrigation_efficiency_pct.toFixed(2)}%</span>
                    </div>
                </div>
            </div>
        </div>
    `,lucide.createIcons()}function bt(e){var w,M,T,E,A,L,d,f,I,b;if(!e)return"";const t=e.split(`
`);let i="",n="",a="",r="",s="",o=[],l=[],p={water:[],grid:[],fuel:[]},v="",g="";for(let k=0;k<t.length;k++){const h=t[k].trim();if(h)if(h.startsWith("ZONE"))i=((w=h.split(":")[1])==null?void 0:w.trim())||"";else if(h.startsWith("STATUS"))n=((M=h.split(":")[1])==null?void 0:M.trim())||"",t[k+1]&&t[k+1].trim().startsWith("[")&&(n+=" "+t[k+1].trim(),k++);else if(h.startsWith("RISK LEVEL"))a=((T=h.split(":")[1])==null?void 0:T.trim())||"";else if(h.startsWith("CRITICALITY"))r=((E=h.split(":")[1])==null?void 0:E.trim())||"";else if(h==="[THERMAL MATRIX]")s="thermal";else if(h==="[RLVR VERIFIER CONSTRAINTS]")s="rlvr";else if(h.startsWith("[SYNTHETIC RESOURCE LEDGER"))s="ledger";else if(h.startsWith("[GLOBAL COOPERATION CONSTRAINT"))s="gcc";else if(s==="thermal"){if(h.startsWith("-")){const B=h.substring(1).split(":");o.push({label:(A=B[0])==null?void 0:A.trim(),val:(L=B[1])==null?void 0:L.trim()})}}else if(s==="rlvr")if(h.startsWith("-")){const B=h.substring(1).split(":");l.push({label:(d=B[0])==null?void 0:d.trim(),val:(f=B[1])==null?void 0:f.trim()})}else l.length>0&&(l[l.length-1].desc=h);else if(s==="ledger"){if(h.startsWith("*"))v=h.substring(1).trim().toLowerCase();else if(h.startsWith("-")&&v){const B=h.substring(1).split(":");p[v].push({label:(I=B[0])==null?void 0:I.trim(),val:(b=B[1])==null?void 0:b.trim()})}}else s==="gcc"&&(g+=h+" ")}const x=n.includes("CRITICAL")?"red":n.includes("WARNING")?"yellow":"green",_=a.includes("CRITICAL")||a.includes("HIGH")?"red":a.includes("MEDIUM")?"yellow":"green",u=parseInt(r.split("/")[0])||50;return`
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <!-- Zone & Status Card -->
            <div style="background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 12px;">
                <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; letter-spacing: 0.05em; margin-bottom: 4px;">Operational Zone</div>
                <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; line-height: 1.3;">${i}</div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 10px;">
                    <div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary); margin-bottom: 4px;">Anomaly Status</div>
                        <span class="kpi-status ${x}" style="font-size: 0.65rem; font-weight: 700; display: inline-block; padding: 2px 6px;">${n}</span>
                    </div>
                    <div>
                        <div style="font-size: 0.6rem; color: var(--text-secondary); margin-bottom: 4px;">Risk Level</div>
                        <span class="kpi-status ${_}" style="font-size: 0.65rem; font-weight: 700; display: inline-block; padding: 2px 6px;">${a}</span>
                    </div>
                </div>
            </div>

            <!-- Criticality Score -->
            <div style="background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary);">Mission Criticality Score</span>
                    <span style="font-size: 0.85rem; font-family: var(--font-data); font-weight: 700; color: var(--yellow-accent);">${r}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${u}%; height: 100%; background: linear-gradient(90deg, var(--green-accent), var(--yellow-accent), var(--red-accent)); border-radius: 3px;"></div>
                </div>
            </div>

            <!-- Thermal Matrix -->
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="thermometer" style="width: 12px; height: 12px; color: var(--yellow-accent);"></i> Thermal Matrix
                </div>
                <ul class="data-grid">
                    ${o.map(k=>`
                        <li class="data-row">
                            <span class="data-label">${k.label}</span>
                            <span class="data-value" style="font-family: var(--font-data); font-weight: 600; color: var(--text-primary);">${k.val}</span>
                        </li>
                    `).join("")}
                </ul>
            </div>

            <!-- RLVR Verifier Constraints -->
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="shield-check" style="width: 12px; height: 12px; color: var(--green-accent);"></i> RLVR Physics Verifier
                </div>
                <div style="background: rgba(16, 185, 129, 0.01); border: 1px solid rgba(16, 185, 129, 0.08); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                    ${l.map(k=>`
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                <span style="font-size: 0.7rem; color: var(--text-secondary);">${k.label}</span>
                                <span style="font-size: 0.75rem; font-family: var(--font-data); font-weight: 700; color: var(--green-accent);">${k.val}</span>
                            </div>
                            ${k.desc?`<div style="font-size: 0.65rem; color: var(--text-secondary); opacity: 0.75; font-style: italic; line-height: 1.3; margin-top: 2px;">${k.desc}</div>`:""}
                        </div>
                    `).join("")}
                </div>
            </div>

            <!-- Synthetic Resource Ledger -->
            <div>
                <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i data-lucide="database" style="width: 12px; height: 12px; color: var(--blue-accent);"></i> Resource Ledger
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${Object.entries(p).filter(([k,h])=>h.length>0).map(([k,h])=>`
                        <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 10px;">
                            <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${k==="water"?"var(--blue-accent)":k==="grid"?"var(--yellow-accent)":"var(--red-accent)"};"></span>
                                ${k}
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${h.map(B=>`
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 0.65rem; color: var(--text-secondary);">${B.label}</span>
                                        <span style="font-size: 0.65rem; font-family: var(--font-data); font-weight: 600; color: var(--text-primary);">${B.val}</span>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>

            <!-- GCC Alert -->
            <div style="background: rgba(239, 68, 68, 0.02); border: 1px solid rgba(239, 68, 68, 0.08); border-radius: 8px; padding: 10px; font-size: 0.65rem; color: var(--text-secondary); line-height: 1.4;">
                <div style="font-weight: 700; color: var(--red-accent); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                    <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i> GLOBAL COOPERATION CONSTRAINT (GCC)
                </div>
                <span>${g}</span>
            </div>
        </div>
    `}function _t(){const e=document.getElementById("agriculture-report-section");if(!e)return;e.classList.remove("hidden");const t=document.getElementById("agri-report-content");if(!t)return;t.innerHTML=`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 10px; color: var(--text-secondary);">
            <i class="refresh-spinner" data-lucide="refresh-cw" style="width: 20px; height: 20px; animation: spin 1s linear infinite; color: var(--accent-color);"></i>
            <span style="font-size: 0.75rem; font-weight: 600; letter-spacing: 0.5px;">Generating report…</span>
        </div>
    `,lucide.createIcons();const i=e.closest(".panel-body");i&&setTimeout(()=>{i.scrollTo({top:i.scrollHeight,behavior:"smooth"})},50);const n=window._activeRegionKey||"pakistan_punjab";Ne(n,"Generate a detailed, technical agronomic report for the region based on the current telemetry. Focus on soil moisture, NDVI, disease risk, reservoir capacity, and sprinkler viability. Return the report in clean HTML format with subheadings and clear bullet points. Do not include conversational greetings or conversational closings, begin directly with the HTML report body.").then(r=>{if(!r||!r.reply){t.innerHTML='<p style="color:var(--text-secondary);font-size:0.75rem;">Error: Model did not respond. Please try again.</p>';return}let s=r.reply;s=s.replace(/^```html\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/,""),!s.includes("<div")&&!s.includes("<p")&&!s.includes("<h")&&(s=s.replace(/^### (.*$)/gim,'<div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-top: 6px; padding-bottom: 6px; font-weight: 700; color: var(--accent-color); font-size: 0.75rem;">$1</div>').replace(/^## (.*$)/gim,'<div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-top: 6px; padding-bottom: 6px; font-weight: 700; color: var(--accent-color); font-size: 0.75rem;">$1</div>').replace(/^\* (.*$)/gim,'<li style="margin-left: 10px; color: var(--text-primary); list-style-type: square;">$1</li>').replace(/^(?!<li|<div|<p)(.*$)/gim,"<p>$1</p>")),t.innerHTML=`
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.72rem; line-height: 1.45; color: var(--text-primary); animation: fadeIn 0.3s ease-out;">
                ${s}
            </div>
        `,i&&i.scrollTo({top:i.scrollHeight,behavior:"smooth"})}).catch(r=>{console.error(r),t.innerHTML='<p style="color:var(--text-secondary);font-size:0.75rem;">Error contacting simulation model.</p>'})}function wt(e){Ye(e);const t=document.querySelector(".chat-card .panel-header .header-title h2"),i=document.querySelector(".chat-card .panel-header .header-title i"),n=document.getElementById("chat-input"),a=document.getElementById("chat-messages-container");e==="crisislens"?(t&&(t.textContent="WIaaS CrisisLens"),i&&(i.setAttribute("data-lucide","shield-alert"),typeof lucide<"u"&&lucide.createIcons()),n&&(n.placeholder="Ask CrisisLens (weather threats, actions, etc.)..."),a.innerHTML=`
            <div class="chat-message agent-msg">
                <div class="msg-header">
                    <span class="agent-tag"><i data-lucide="shield-alert"></i> CrisisLens Agent</span>
                    <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <p class="msg-text">Greetings, Operator. The CrisisLens threat monitoring system is active. I can process live regional weather and disaster feeds, evaluate risk severity, explain indicators, and map actions for Farmers, the Public, Grid Teams, and Logistics. What region or threat would you like to evaluate?</p>
                <div class="system-notification" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.05);">
                    <span class="notif-title" style="color: #ef4444;">CrisisLens Active</span>
                    <p class="notif-body">Webhook connected. Direct response routing enabled for Sylhet, Punjab, Paris, and all active zones.</p>
                </div>
            </div>
        `,typeof lucide<"u"&&lucide.createIcons()):(t&&(t.textContent="WIaaS AI Assistant"),i&&(i.setAttribute("data-lucide","sparkles"),typeof lucide<"u"&&lucide.createIcons()),n&&(n.placeholder="Ask WIaaS agent swarm anything..."),a.innerHTML=`
            <div class="chat-message agent-msg">
                <div class="msg-header">
                    <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0</span>
                    <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <p class="msg-text">Greetings, Operator. I am analyzing the telemetry feed across five specialized models. What sector requires focus?</p>
                <div class="system-notification">
                    <span class="notif-title">System Notification</span>
                    <p class="notif-body" id="system-notification-text">Global weather models have just compiled a new ensemble forecast for the Next 72 Hours. Focus is recommended on Sector West Grid.</p>
                </div>
            </div>
        `,typeof lucide<"u"&&lucide.createIcons())}function Et(e){if(!e)return"";if(Array.isArray(e)&&e.length>0){const t=e[0];return t&&typeof t=="object"?t.output||t.message||t.text||JSON.stringify(t):String(t)}return typeof e=="object"?e.output||e.message||e.text||e.reply||JSON.stringify(e):String(e)}async function $e(){const e=document.getElementById("chat-input"),t=document.getElementById("chat-messages-container"),i=e.value.trim();if(!i)return;const n=document.createElement("div");n.className="chat-message user-msg",n.innerHTML=`
        <div class="msg-header">
            <span class="user-tag">Operator</span>
            <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        <p class="msg-text">${Ge(i)}</p>
    `,t.appendChild(n),e.value="",t.scrollTop=t.scrollHeight;const a="loading-"+Date.now(),r=document.createElement("div");r.id=a,r.className="chat-message agent-msg",r.innerHTML=`
        <div class="msg-header">
            <span class="agent-tag"><i data-lucide="${Q==="crisislens"?"shield-alert":"cpu"}"></i> ${Q==="crisislens"?"CrisisLens Agent":"WIaaS-SWARM-V1.0"}</span>
            <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        <p class="msg-text" style="opacity: 0.7;"><em>${Q==="crisislens"?"Contacting CrisisLens Webhook...":"Contacting n8n AI Swarm..."}</em></p>
    `,t.appendChild(r),lucide.createIcons(),t.scrollTop=t.scrollHeight;try{let s="",o="",l="";if(Q==="crisislens"){o="CrisisLens Agent",l="shield-alert";const g=await gt(i);if(!g)throw new Error("No response from CrisisLens webhook");s=Et(g)}else{o="WIaaS-SWARM-V1.0 (n8n)",l="cpu";const g=await Ne(C,i);if(!g)throw new Error("No response from backend");s=g.reply}const p=document.getElementById(a);p&&p.remove();const v=document.createElement("div");v.className="chat-message agent-msg",v.innerHTML=`
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="${l}"></i> ${o}</span>
                <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p class="msg-text">${kt(s)}</p>
        `,t.appendChild(v),lucide.createIcons(),t.scrollTop=t.scrollHeight}catch(s){console.error("[chat] handleUserMessage failed:",s);const o=document.getElementById(a);o&&o.remove();const l=document.createElement("div");l.className="chat-message agent-msg",l.innerHTML=`
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="alert-triangle"></i> System Error</span>
                <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p class="msg-text" style="color: #ef4444;">Connection failed. Check network or webhook configuration.</p>
        `,t.appendChild(l),lucide.createIcons(),t.scrollTop=t.scrollHeight}}function kt(e){return e?Ge(e).replace(/\\n/g,"<br>").replace(/\n/g,"<br>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>"):""}function Ge(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function It(){S.loadFromDisk("wiaas_selected_cities"),De(),Tt(),Ct()}function Tt(){const e=document.getElementById("left-sidebar");if(!e||document.getElementById("city-search-panel"))return;const t=document.createElement("div");t.id="city-search-panel",t.className="panel-card city-search-card hidden",t.innerHTML=`
        <div class="panel-header">
            <div class="header-title">
                <i data-lucide="search" class="accent-icon"></i>
                <h2>City Explorer</h2>
            </div>
            <div class="header-actions">
                <button class="action-btn" id="toggle-city-panel" title="Toggle"><i data-lucide="chevron-right"></i></button>
            </div>
        </div>
        <div class="panel-body city-search-body">
            <!-- Search Input -->
            <div class="city-search-input-wrapper">
                <input 
                    type="text" 
                    id="city-search-input" 
                    placeholder="Search city (e.g., Paris, Mumbai, Lagos)..."
                    autocomplete="off"
                    class="city-search-input"
                />
                <button id="city-search-btn" class="city-search-btn" title="Search">
                    <i data-lucide="search"></i>
                </button>
            </div>
            
            <!-- Search Results -->
            <div id="city-search-results" class="city-search-results hidden">
                <!-- Results dynamically inserted here -->
            </div>
            
            <!-- Selected Cities List -->
            <div class="city-selected-section">
                <h3 class="section-title">Your Selected Cities</h3>
                <div id="city-selected-list" class="city-list">
                    <!-- Selected cities dynamically inserted here -->
                </div>
            </div>
            
            <!-- Actions -->
            <div class="city-actions">
                <button id="city-refresh-globe-btn" class="action-btn-primary" title="Update Globe">
                    <i data-lucide="globe"></i> Refresh Globe
                </button>
                <button id="city-clear-all-btn" class="action-btn-secondary" title="Clear All">
                    <i data-lucide="trash-2"></i> Clear All
                </button>
            </div>
        </div>
    `;const i=e.querySelector(".panel-card");i?e.insertBefore(t,i):e.appendChild(t),typeof lucide<"u"&&lucide.createIcons()}function Ct(){const e=document.getElementById("city-search-input"),t=document.getElementById("city-search-btn"),i=document.getElementById("city-clear-all-btn"),n=document.getElementById("city-refresh-globe-btn"),a=document.getElementById("toggle-city-panel");if(a==null||a.addEventListener("click",()=>{const s=document.getElementById("city-search-panel"),o=a.querySelector("i"),l=s.classList.toggle("collapsed");o&&o.setAttribute("data-lucide",l?"chevron-down":"chevron-right"),typeof lucide<"u"&&lucide.createIcons()}),!e)return;t==null||t.addEventListener("click",()=>ce()),e.addEventListener("keypress",s=>{s.key==="Enter"&&ce()});let r;e.addEventListener("input",()=>{if(clearTimeout(r),e.value.trim().length<2){const o=document.getElementById("city-search-results");o&&(o.classList.add("hidden"),o.innerHTML="");return}r=setTimeout(()=>{ce()},300)}),i==null||i.addEventListener("click",async()=>{confirm("Clear all selected cities?")&&(S.clearAllCities(),S.saveToDisk("wiaas_selected_cities"),Y(),await V(S.getAllCities()))}),n==null||n.addEventListener("click",async()=>{const s=S.getAllCities();if(s.length===0){alert("No cities selected. Search and add cities first.");return}await V(s),console.log("[ui-cities] Globe updated with",s.length,"cities")}),Y()}async function ce(){var n;const e=document.getElementById("city-search-input"),t=(n=e==null?void 0:e.value)==null?void 0:n.trim();if(!t||t.length<2)return;const i=document.getElementById("city-search-results");if(i){i.classList.remove("hidden"),i.innerHTML='<p class="search-loading">Searching...</p>';try{const a=await S.searchCities(t,10);if(a.length===0){i.innerHTML='<p class="search-no-results">No cities found. Try a different search.</p>';return}i.innerHTML=a.map((r,s)=>`
            <div class="city-result-item" data-index="${s}">
                <div class="city-result-info">
                    <div class="city-result-name">${fe(r.name)}</div>
                    <div class="city-result-details">${fe(r.displayName)}</div>
                </div>
                <button class="city-result-add-btn" data-city-index="${s}" title="Add this city">
                    <i data-lucide="plus"></i>
                </button>
            </div>
        `).join(""),typeof lucide<"u"&&lucide.createIcons(),i.querySelectorAll(".city-result-add-btn").forEach(r=>{r.addEventListener("click",async()=>{const s=parseInt(r.dataset.cityIndex),o=a[s];S.addCity(o)?(S.saveToDisk("wiaas_selected_cities"),ze(o),Y(),e.value="",i.classList.add("hidden"),await V(S.getAllCities()),console.log("[ui-cities] Added city:",o.name)):alert("City already added or limit reached.")})})}catch(a){console.error("[ui-cities] Search error:",a),i.innerHTML='<p class="search-error">Search failed. Please try again.</p>'}}}function Y(){const e=document.getElementById("city-selected-list");if(!e)return;const t=S.getAllCities();if(t.length===0){e.innerHTML='<p class="city-list-empty">No cities selected. Search above to add.</p>';return}e.innerHTML=t.map((i,n)=>{const a=i.id===C;return`
            <div class="city-item" data-city-id="${i.id}">
                <div class="city-item-info">
                    <div class="city-item-name">${fe(i.name)}</div>
                    <div class="city-item-coords">${i.latitude.toFixed(2)}°, ${i.longitude.toFixed(2)}°</div>
                </div>
                <div class="city-item-actions">
                    <button class="city-item-select-btn ${a?"active":""}" data-city-id="${i.id}" title="Select as active">
                        <i data-lucide="target"></i>
                    </button>
                    <button class="city-item-remove-btn" data-city-id="${i.id}" title="Remove">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `}).join(""),typeof lucide<"u"&&lucide.createIcons(),e.querySelectorAll(".city-item-remove-btn").forEach(i=>{i.addEventListener("click",async()=>{const n=i.dataset.cityId;S.removeCity(n),S.saveToDisk("wiaas_selected_cities"),Y(),await V(S.getAllCities())})}),e.querySelectorAll(".city-item-select-btn").forEach(i=>{i.addEventListener("click",()=>{const n=i.dataset.cityId,a=t.find(r=>r.id===n);if(a){Re(a.id);const r=new CustomEvent("citySelected",{detail:{cityId:n,city:a}});document.dispatchEvent(r),console.log("[ui-cities] Selected city:",a.name),Y()}})})}function fe(e){const t={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"};return e.replace(/[&<>"']/g,i=>t[i])}function Mt(){const e=document.getElementById("toggle-left-dock");e&&e.addEventListener("click",()=>{const o=document.getElementById("left-sidebar"),l=document.getElementById("left-dock-icon"),p=o.classList.toggle("visible");l.setAttribute("data-lucide",p?"chevron-left":"chevron-right"),lucide.createIcons()}),document.getElementById("toggle-right-dock").addEventListener("click",()=>{const o=document.getElementById("right-sidebar"),l=document.getElementById("right-dock-icon"),p=o.classList.toggle("visible");l.setAttribute("data-lucide",p?"chevron-right":"chevron-left"),lucide.createIcons()}),document.getElementById("refresh-data-btn").addEventListener("click",()=>{re(C)}),document.getElementById("close-left-panel").addEventListener("click",()=>{de()});const t=document.getElementById("generate-agri-report-btn");t&&t.addEventListener("click",()=>{_t()});const i=document.getElementById("close-agri-report");i&&i.addEventListener("click",()=>{const o=document.getElementById("agriculture-report-section");o&&o.classList.add("hidden")}),document.getElementById("close-general-panel").addEventListener("click",()=>{de()}),document.getElementById("close-right-panel").addEventListener("click",()=>{const o=document.getElementById("right-sidebar"),l=document.getElementById("right-dock-icon");o.classList.remove("visible"),l.setAttribute("data-lucide","chevron-left"),document.querySelectorAll(".nav-item").forEach(p=>p.classList.remove("active")),lucide.createIcons()}),document.getElementById("toggle-bottom-panel").addEventListener("click",()=>{const o=document.getElementById("bottom-panel"),l=document.getElementById("bottom-toggle-icon"),p=o.classList.toggle("collapsed");l.setAttribute("data-lucide",p?"chevron-up":"chevron-down"),lucide.createIcons()});const n=document.querySelectorAll(".nav-item");n.forEach(o=>{o.addEventListener("click",()=>{const l=o.getAttribute("data-tab"),p=o.classList.contains("active");if(["region","physics","agriculture","grid","logistics","research","globe-analysis"].includes(l)){if(p)o.classList.remove("active"),de();else{n.forEach(g=>g.classList.remove("active")),o.classList.add("active"),document.getElementById("left-sidebar").classList.add("visible"),document.getElementById("left-dock-icon").setAttribute("data-lucide","chevron-left");const v=document.getElementById("city-search-panel");if(v&&(l==="region"?v.classList.remove("hidden"):v.classList.add("hidden")),l==="agriculture")document.getElementById("agriculture-panel").classList.remove("hidden"),document.getElementById("general-info-panel").classList.add("hidden");else{document.getElementById("agriculture-panel").classList.add("hidden"),document.getElementById("general-info-panel").classList.remove("hidden"),ue(l);const g=document.getElementById("agriculture-report-section");g&&g.classList.add("hidden")}lucide.createIcons()}ve==="agents"&&le()}else if(l==="agents"||l==="crisislens")wt(l==="crisislens"?"crisislens":"assistant"),p?(o.classList.remove("active"),document.getElementById("right-sidebar").classList.remove("visible"),document.getElementById("right-dock-icon").setAttribute("data-lucide","chevron-left"),l==="crisislens"&&(document.getElementById("left-sidebar").classList.remove("visible"),document.getElementById("left-dock-icon").setAttribute("data-lucide","chevron-right"))):(n.forEach(g=>g.classList.remove("active")),o.classList.add("active"),document.getElementById("right-sidebar").classList.add("visible"),document.getElementById("right-dock-icon").setAttribute("data-lucide","chevron-right"),l==="crisislens"&&(document.getElementById("left-sidebar").classList.add("visible"),document.getElementById("left-dock-icon").setAttribute("data-lucide","chevron-left"),ue("crisislens")),Ce("agents"),le(),document.getElementById("bottom-panel").classList.remove("collapsed"),document.getElementById("bottom-toggle-icon").setAttribute("data-lucide","chevron-down")),lucide.createIcons();else if(l==="analytics"){Ce("analytics"),le();const v=document.getElementById("bottom-panel"),g=document.getElementById("bottom-toggle-icon");v.classList.remove("collapsed"),g.setAttribute("data-lucide","chevron-down"),lucide.createIcons()}})});const a=document.getElementById("chat-input"),r=document.getElementById("send-chat-btn"),s=document.getElementById("clear-chat");r.addEventListener("click",$e),a.addEventListener("keydown",o=>{o.key==="Enter"&&$e()}),s.addEventListener("click",()=>{document.getElementById("chat-messages-container").innerHTML=""})}async function re(e){const t=await he(e);t&&(te[e]=t,V(S.getAllCities()),vt(t),Y())}async function Lt(e){(await mt(e)).forEach((i,n)=>{te[n]=i}),V(S.getAllCities())}function Oe(e){Re(e),re(e);const t=document.getElementById("city-search-panel");t&&t.classList.remove("hidden"),ue("region")}function de(){document.getElementById("left-sidebar").classList.remove("visible");const e=document.getElementById("left-dock-icon");e&&e.setAttribute("data-lucide","chevron-right"),document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));const t=document.getElementById("city-search-panel");t&&t.classList.add("hidden");const i=document.getElementById("agriculture-report-section");i&&i.classList.add("hidden"),lucide.createIcons()}window.__wiaas={toggleHeatmap:st,toggleWind:rt,togglePrecipitation:ot,selectActiveRegion:Oe};window.closeGlobePopup=function(){const e=document.getElementById("globe-popup-overlay");e&&e.classList.add("hidden")};document.addEventListener("DOMContentLoaded",async()=>{const e=Date.now();lucide.createIcons(),await It(),at(),lt(),Mt(),await re("pakistan_punjab"),setInterval(async()=>{C&&await re(C)},1e3),Lt(ne),ht(),Be(),setInterval(Be,1e3),lucide.createIcons();const t=Date.now()-e,i=1800;t<i&&await new Promise(a=>setTimeout(a,i-t));const n=document.getElementById("loading-screen");n&&(n.classList.add("zoom-out"),await new Promise(a=>setTimeout(a,100)),n.classList.add("fade-out"),setTimeout(()=>n.remove(),1200)),document.addEventListener("citySelected",async a=>{const{cityId:r,city:s}=a.detail;console.log("[main] City selected:",s),await Oe(r)})});
