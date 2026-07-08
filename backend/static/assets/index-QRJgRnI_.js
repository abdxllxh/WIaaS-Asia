(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))o(i);new MutationObserver(i=>{for(const n of i)if(n.type==="childList")for(const s of n.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function a(i){const n={};return i.integrity&&(n.integrity=i.integrity),i.referrerPolicy&&(n.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?n.credentials="include":i.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(i){if(i.ep)return;i.ep=!0;const n=a(i);fetch(i.href,n)}})();const y={userCities:[],nominatimCache:{},async searchCities(e,t=5){if(!e||e.trim().length<2)return[];const a=`${e.toLowerCase()}_${t}`;if(this.nominatimCache[a])return this.nominatimCache[a];try{const o=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(e)}&format=json&limit=${t}`);if(!o.ok)throw new Error(`HTTP ${o.status}`);const n=(await o.json()).map(s=>({name:s.name||s.display_name.split(",")[0],displayName:s.display_name,latitude:parseFloat(s.lat),longitude:parseFloat(s.lon),osmType:s.osm_type,osmId:s.osm_id,boundingBox:s.boundingbox,type:s.type}));return this.nominatimCache[a]=n,n}catch(o){return console.error("[cities] Nominatim search failed:",o),[]}},async getCityFromCoordinates(e,t){var o,i,n;const a=`reverse_${e}_${t}`;if(this.nominatimCache[a])return this.nominatimCache[a];try{const s=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e}&lon=${t}`);if(!s.ok)throw new Error(`HTTP ${s.status}`);const r=await s.json(),c={name:r.name||((o=r.address)==null?void 0:o.city)||((i=r.address)==null?void 0:i.town)||"Unknown",displayName:r.display_name,latitude:parseFloat(r.lat),longitude:parseFloat(r.lon),country:((n=r.address)==null?void 0:n.country)||""};return this.nominatimCache[a]=c,c}catch(s){return console.error("[cities] Reverse geocoding failed:",s),null}},addCity(e){return!this.userCities.some(a=>a.latitude===e.latitude&&a.longitude===e.longitude)&&this.userCities.length<50?(this.userCities.push({...e,id:`${e.latitude}_${e.longitude}`,addedAt:new Date().toISOString()}),!0):!1},removeCity(e){this.userCities=this.userCities.filter(t=>t.id!==e)},getAllCities(){return this.userCities},clearAllCities(){this.userCities=[]},exportToJSON(){return JSON.stringify(this.userCities)},importFromJSON(e){try{return this.userCities=JSON.parse(e),!0}catch(t){return console.error("[cities] Import failed:",t),!1}},saveToDisk(e="wiaas_cities"){try{return localStorage.setItem(e,this.exportToJSON()),!0}catch(t){return console.error("[cities] Save to disk failed:",t),!1}},loadFromDisk(e="wiaas_cities"){try{const t=localStorage.getItem(e);return t?this.importFromJSON(t):!1}catch(t){return console.error("[cities] Load from disk failed:",t),!1}}};let S="pakistan_punjab";function re(e){S=e}const he={pakistan_punjab:"Punjab Region, Pakistan",togo_maritime:"Maritime Region, Togo",france_paris:"Paris, France",spain_andalusia:"Andalusia, Spain",germany_bavaria:"Bavaria, Germany",uk_london:"Greater London, UK",italy_sicily:"Sicily, Italy",usa_california_central_valley:"Central Valley, California","usa_texas_houston:":"Houston, Texas",brazil_cerrado:"Cerrado Savannah, Brazil",canada_alberta:"Alberta Plains, Canada",argentina_pampas:"The Pampas, Argentina"},fe={pakistan_punjab:5,togo_maritime:0,france_paris:2,spain_andalusia:2,germany_bavaria:2,uk_london:1,italy_sicily:2,usa_california_central_valley:-7,usa_texas_houston:-5,brazil_cerrado:-3,canada_alberta:-6,argentina_pampas:-3};let W=["pakistan_punjab","togo_maritime","france_paris","spain_andalusia","germany_bavaria","uk_london","italy_sicily","usa_california_central_valley","usa_texas_houston","brazil_cerrado","canada_alberta","argentina_pampas"],le={...he},ce={...fe};function de(e){e.id||(e.id=`city_${e.latitude}_${e.longitude}`),W.includes(e.id)||(W.push(e.id),le[e.id]=e.displayName||e.name,ce[e.id]=0)}function ye(){y.getAllCities().forEach(t=>{de(t)})}const K={};let V=!0,D=!1,O=!1;function ve(e){V=e}function be(e){D=e}function Ee(e){O=e}const xe={pakistan_punjab:{lat:31.17,lon:72.7},togo_maritime:{lat:6.13,lon:1.22},france_paris:{lat:48.85,lon:2.35},spain_andalusia:{lat:37.38,lon:-5.98},germany_bavaria:{lat:48.79,lon:11.49},uk_london:{lat:51.5,lon:-.12},italy_sicily:{lat:37.6,lon:14.01},usa_california_central_valley:{lat:36.77,lon:-119.41},usa_texas_houston:{lat:29.76,lon:-95.36},brazil_cerrado:{lat:-14.23,lon:-51.92},canada_alberta:{lat:53.93,lon:-116.57},argentina_pampas:{lat:-34.6,lon:-58.38}},P=1.6;function ue(e,t,a=P){const o=(90-e)*(Math.PI/180),i=(t+180)*(Math.PI/180);return new THREE.Vector3(-a*Math.cos(i)*Math.sin(o),a*Math.cos(o),a*Math.sin(i)*Math.sin(o))}const _e=`
    varying vec2 vUv;
    varying vec3 vLocalPosition;
    void main() {
        vUv = uv;
        vLocalPosition = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,we=`
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
`,Te=`
    varying vec2 vUv;
    varying vec3 vNormalW;
    void main() {
        vUv = uv;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,Ce=`
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
`,Ie=`
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,Me=`
    varying vec3 vNormal;
    void main() {
        float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
        gl_FragColor = vec4(0.2, 0.55, 1.0, 1.0) * intensity;
    }
`;let x,k,$,T,A,J,B,z=[],N=[],U=[],G,F,_=4.5;const ae=2.3,ie=8.5;function me(e){const a=document.createElement("canvas");a.width=a.height=128;const o=a.getContext("2d"),i=a.width/2,n=o.createRadialGradient(i,i,0,i,i,i);n.addColorStop(0,`rgba(${e}, 1)`),n.addColorStop(.22,`rgba(${e}, 0.95)`),n.addColorStop(.55,`rgba(${e}, 0.28)`),n.addColorStop(1,`rgba(${e}, 0)`),o.fillStyle=n,o.fillRect(0,0,128,128);const s=new THREE.CanvasTexture(a);return s.needsUpdate=!0,s}function ne(e,t,a,o,i){const n=new THREE.BufferGeometry,s=new Float32Array(e*3);for(let p=0;p<e;p++){const C=Math.random(),g=Math.random(),h=C*2*Math.PI,u=Math.acos(2*g-1),d=t+Math.random()*(a-t);s[p*3]=d*Math.sin(u)*Math.cos(h),s[p*3+1]=d*Math.sin(u)*Math.sin(h),s[p*3+2]=d*Math.cos(u)}n.setAttribute("position",new THREE.BufferAttribute(s,3));const r=me("255, 255, 255"),c=new THREE.PointsMaterial({color:o,size:i,map:r,transparent:!0,blending:THREE.AdditiveBlending,depthWrite:!1});return new THREE.Points(n,c)}function Se(){const e=document.getElementById("globe-container"),t=e.clientWidth,a=e.clientHeight;x=new THREE.Scene,x.background=null,k=new THREE.PerspectiveCamera(45,t/a,.1,1e3),k.position.z=_,$=new THREE.WebGLRenderer({antialias:!0,alpha:!0}),$.setSize(t,a),$.setPixelRatio(Math.min(2,window.devicePixelRatio)),e.appendChild($.domElement),e.style.cursor="grab";const o=new THREE.Vector3(5,3,5),i=new THREE.DirectionalLight(16777215,1.6);i.position.copy(o),x.add(i),x.add(new THREE.AmbientLight(1122867,.35));const n=new THREE.TextureLoader,s=n.load("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"),r=n.load("https://unpkg.com/three-globe/example/img/earth-night.jpg"),c=n.load("https://unpkg.com/three-globe/example/img/earth-water.png"),p=n.load("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png"),C={specularMap:{value:c},regionPos:{value:new Float32Array(36)},regionTemp:{value:new Float32Array(12)}};B=new THREE.ShaderMaterial({uniforms:C,vertexShader:_e,fragmentShader:we,transparent:!0,opacity:.95}),J=new THREE.ShaderMaterial({uniforms:{dayTexture:{value:s},nightTexture:{value:r},specularMap:{value:c},sunDirection:{value:o.clone().normalize()}},vertexShader:Te,fragmentShader:Ce}),T=new THREE.Mesh(new THREE.SphereGeometry(P,96,96),V?B:J),x.add(T);const g=new THREE.Mesh(new THREE.SphereGeometry(P*1.016,64,64),new THREE.MeshPhongMaterial({map:p,alphaMap:p,transparent:!0,opacity:.38,depthWrite:!1}));x.add(g),T.userData.cloudSphere=g,x.add(new THREE.Mesh(new THREE.SphereGeometry(P*1.05,64,64),new THREE.ShaderMaterial({vertexShader:Ie,fragmentShader:Me,blending:THREE.AdditiveBlending,side:THREE.BackSide,transparent:!0}))),A=new THREE.Group,T.add(A),H(),G=ne(400,15,30,8246268,.16),F=ne(800,35,60,16777215,.08),x.add(G),x.add(F);let h=!1,u={x:0,y:0},d={x:0,y:0};e.addEventListener("mousedown",l=>{h=!0,u={x:l.clientX,y:l.clientY},e.style.cursor="grabbing"}),e.addEventListener("mousemove",l=>{h&&(d.y+=(l.clientX-u.x)*.005,d.x+=(l.clientY-u.y)*.005,d.x=Math.max(-Math.PI/3,Math.min(Math.PI/3,d.x)),u={x:l.clientX,y:l.clientY})}),window.addEventListener("mouseup",()=>{h=!1,e.style.cursor="grab"}),e.addEventListener("wheel",l=>{l.preventDefault(),_+=l.deltaY*.0022*_,_=Math.max(ae,Math.min(ie,_)),k.position.z=_},{passive:!1});let v=null,b=_;function L(l){const m=l[0].clientX-l[1].clientX,E=l[0].clientY-l[1].clientY;return Math.sqrt(m*m+E*E)}e.addEventListener("touchstart",l=>{l.touches.length===2?(v=L(l.touches),b=_):l.touches.length===1&&(h=!0,u={x:l.touches[0].clientX,y:l.touches[0].clientY})},{passive:!0}),e.addEventListener("touchmove",l=>{if(l.touches.length===2&&v){const m=L(l.touches),E=v/m;_=Math.max(ae,Math.min(ie,b*E)),k.position.z=_}else if(l.touches.length===1&&h){const m=l.touches[0];d.y+=(m.clientX-u.x)*.005,d.x+=(m.clientY-u.y)*.005,d.x=Math.max(-Math.PI/3,Math.min(Math.PI/3,d.x)),u={x:m.clientX,y:m.clientY}}},{passive:!0}),e.addEventListener("touchend",()=>{h=!1,v=null});let f=0,I=0;function te(){if(requestAnimationFrame(te),document.hidden)return;I+=.05,f+=.0012,T.rotation.y=f+d.y,T.rotation.x=d.x;const l=T.userData.cloudSphere;l&&(l.rotation.y=f*1.08+d.y,l.rotation.x=d.x),G&&(G.rotation.y=f*.08+d.y*.12,G.rotation.x=d.x*.12),F&&(F.rotation.y=f*.02+d.y*.04,F.rotation.x=d.x*.04),O&&N.length>0&&N.forEach((m,E)=>{const M=1+Math.abs(Math.sin(I+E))*.8;m.scale.set(M,M,1)}),D&&z.length>0&&z.forEach((m,E)=>{const M=.8+Math.sin(I*1.5+E)*.2;m.setLength(.35*M,.08*M,.04*M)}),U.length>0&&U.forEach((m,E)=>{const M=1+Math.sin(I*2+E*1.3)*.18;m.scale.set(m.userData.baseScale*M,m.userData.baseScale*M,1)}),document.getElementById("globe-popup-overlay"),$.render(x,k)}te(),window.addEventListener("resize",()=>{const l=e.clientWidth,m=e.clientHeight;k.aspect=l/m,k.updateProjectionMatrix(),$.setSize(l,m)})}async function H(e=[]){z.forEach(o=>A.remove(o)),N.forEach(o=>A.remove(o)),A.clear(),z=[],N=[],U=[];const t=new Float32Array(36),a=new Float32Array(12);W.forEach((o,i)=>{const n=K[o],s=xe[o];if(!s)return;let r=20,c=10,p=0,C=50;n&&(r=n.telemetry.temperature_celsius,c=n.telemetry.wind_speed_kmh,p=n.telemetry.wind_direction_degrees,C=n.telemetry.humidity_percentage);const g=ue(s.lat,s.lon,P);t[i*3]=g.x,t[i*3+1]=g.y,t[i*3+2]=g.z,a[i]=Math.max(0,Math.min(1,(r+5)/50));const h=g.clone().normalize(),u=new THREE.Vector3(0,1,0).projectOnPlane(h).normalize(),d=h.clone().cross(new THREE.Vector3(0,1,0)).normalize(),v=p*Math.PI/180,b=u.clone().multiplyScalar(Math.cos(v)).add(d.clone().multiplyScalar(Math.sin(v))).normalize(),L=new THREE.ArrowHelper(b,g,.15+c/60*.35,3718648,.08,.04);L.visible=D,A.add(L),z.push(L);const f=new THREE.Mesh(new THREE.RingGeometry(.08,.11,16),new THREE.MeshBasicMaterial({color:58879,side:THREE.DoubleSide,transparent:!0,opacity:C/100*.8}));f.position.copy(g),f.lookAt(0,0,0),f.visible=O&&C>60,A.add(f),N.push(f)}),e&&e.length>0&&e.forEach((o,i)=>{const n=Le(o,i);A.add(n),U.push(n)}),B&&B.uniforms&&(B.uniforms.regionPos.value=t,B.uniforms.regionTemp.value=a)}function Le(e,t){const a=["255, 107, 107","78, 205, 196","255, 230, 109","149, 225, 211","255, 138, 163","133, 220, 176"],o=a[t%a.length],i=new THREE.SpriteMaterial({map:me(o),transparent:!0,depthWrite:!1,blending:THREE.AdditiveBlending}),n=new THREE.Sprite(i),s=.11;return n.scale.set(s,s,1),n.position.copy(ue(e.latitude,e.longitude,P*1.008)),n.userData={city:e,baseScale:s,createdAt:Date.now()},n}function Ae(){ve(!V),T&&(T.material=V?B:J,T.material.needsUpdate=!0)}function ke(){be(!D),z.forEach(e=>{e.visible=D})}function Re(){Ee(!O),N.forEach(e=>{e.visible=O})}let w=null,j=null,R=null;function Be(){const e=document.getElementById("radarChart").getContext("2d");w=new Chart(e,{type:"radar",data:{labels:["Transpiration","NDVI Index","Soil Moisture","Canopy Cover","Nitrogen Level"],datasets:[{label:"Index Value",data:[.72,.82,.65,.55,.7],backgroundColor:"rgba(16, 185, 129, 0.15)",borderColor:"#10b981",borderWidth:2,pointBackgroundColor:"#10b981",pointBorderColor:"#fff",pointHoverBackgroundColor:"#fff",pointHoverBorderColor:"#10b981"}]},options:{responsive:!0,maintainAspectRatio:!1,scales:{r:{angleLines:{color:"rgba(255, 255, 255, 0.08)"},grid:{color:"rgba(255, 255, 255, 0.08)"},pointLabels:{color:"#9090a0",font:{family:"Outfit",size:9}},ticks:{display:!1},suggestedMin:0,suggestedMax:1}},plugins:{legend:{display:!1}}}});const t=document.getElementById("vramChart").getContext("2d"),a=t.createLinearGradient(0,0,0,180);a.addColorStop(0,"rgba(56, 189, 248, 0.8)"),a.addColorStop(1,"rgba(56, 189, 248, 0.1)");const o=t.createLinearGradient(0,0,0,180);o.addColorStop(0,"rgba(0, 229, 255, 0.95)"),o.addColorStop(1,"rgba(0, 229, 255, 0.15)"),j=new Chart(t,{type:"bar",data:{labels:["Agri-Agent","Grid-Agent","Logistics","Regulator","Base Swarm"],datasets:[{data:[32,28,42,18,40.5],backgroundColor:[a,a,o,a,o],borderColor:"#38bdf8",borderWidth:1.5,borderRadius:6,borderSkipped:!1}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{x:{grid:{display:!1},ticks:{color:"#9090a0",font:{family:"Outfit",size:9}}},y:{grid:{color:"rgba(255, 255, 255, 0.04)"},ticks:{color:"#9090a0",font:{family:"JetBrains Mono",size:9}},suggestedMax:50}},animation:{duration:800,easing:"easeOutQuart"}}});const i=document.getElementById("tempPowerChart").getContext("2d"),n=i.createLinearGradient(0,0,0,200);n.addColorStop(0,"rgba(56, 189, 248, 0.25)"),n.addColorStop(1,"rgba(56, 189, 248, 0.0)");const s=i.createLinearGradient(0,0,0,200);s.addColorStop(0,"rgba(239, 68, 68, 0.18)"),s.addColorStop(1,"rgba(239, 68, 68, 0.0)"),R=new Chart(i,{type:"line",data:{labels:["10s ago","8s ago","6s ago","4s ago","2s ago","Now"],datasets:[{label:"Power Draw (W)",data:[610,620,605,630,642,656],borderColor:"#38bdf8",backgroundColor:n,fill:!0,borderWidth:2,tension:.35,pointBackgroundColor:"#38bdf8",pointBorderColor:"rgba(255,255,255,0.7)",pointRadius:4,pointHoverRadius:6,yAxisID:"yPower"},{label:"Core Temp (°C)",data:[72,73,72,74,75,75],borderColor:"#ef4444",backgroundColor:s,fill:!0,borderWidth:2,tension:.35,pointBackgroundColor:"#ef4444",pointBorderColor:"rgba(255,255,255,0.7)",pointRadius:4,pointHoverRadius:6,yAxisID:"yTemp"}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{x:{grid:{display:!1},ticks:{color:"#9090a0",font:{family:"Outfit",size:9}}},yPower:{type:"linear",position:"left",grid:{color:"rgba(255, 255, 255, 0.04)"},ticks:{color:"#38bdf8",font:{family:"JetBrains Mono",size:9}}},yTemp:{type:"linear",position:"right",grid:{display:!1},ticks:{color:"#ef4444",font:{family:"JetBrains Mono",size:9}}}},animation:{duration:800,easing:"easeOutQuart"}}})}function He(e,t){w&&(w.data.datasets[0].data=e,t>.7?(w.data.datasets[0].borderColor="#10b981",w.data.datasets[0].backgroundColor="rgba(16, 185, 129, 0.15)"):t>.5?(w.data.datasets[0].borderColor="#f59e0b",w.data.datasets[0].backgroundColor="rgba(245, 158, 11, 0.15)"):(w.data.datasets[0].borderColor="#ef4444",w.data.datasets[0].backgroundColor="rgba(239, 68, 68, 0.15)"),w.update())}function $e(e,t){R&&(R.data.datasets[0].data.shift(),R.data.datasets[0].data.push(e),R.data.datasets[1].data.shift(),R.data.datasets[1].data.push(t),R.update("active"))}function Pe(){if(!j)return;const t=[32,28,42,18,40.5].map(a=>{const o=(Math.random()-.5)*4;return Math.max(5,Math.min(80,parseFloat((a+o).toFixed(1))))});j.data.datasets[0].data=t,j.update("active")}async function Q(e){try{const t=await fetch(`/analytics/${e}`);if(!t.ok)throw new Error(`HTTP ${t.status}`);return await t.json()}catch(t){return console.error(`[api] fetchRegionAnalytics(${e}) failed:`,t),null}}async function ze(e){const t=new Map;return await Promise.all(e.map(async a=>{const o=await Q(a);o&&t.set(a,o)})),t}async function Ne(e,t){try{const a=await fetch(`/analytics/${e}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:t})});if(!a.ok)throw new Error(`HTTP ${a.status}`);return await a.json()}catch(a){return console.error(`[api] sendChatSimulation(${e}) failed:`,a),null}}function De(e){const t=document.getElementById("current-region-name");t&&(t.innerText=e.region_name);const a=e.climate_matrix,o=e.telemetry,i=e.ledger,n=document.getElementById("crop-health-status");n.innerText=e.system_status.replace(/_/g," "),n.className="kpi-status",e.system_status==="HEALTHY"?n.classList.add("green"):e.system_status==="ADVISORY"?n.classList.add("yellow"):n.classList.add("red");const s=Math.max(0,a.deviation_from_baseline_celsius*.05)+Math.max(0,(a.wet_bulb_celsius-25)*.02),r=Math.max(.12,.85-s);document.getElementById("crop-health-value").innerText=r.toFixed(2);const c=[Math.max(.1,.85-a.vapor_pressure_deficit_kpa*.15),parseFloat(r.toFixed(2)),Math.max(.1,.75-a.vapor_pressure_deficit_kpa*.12),Math.max(.2,.8-s*.5),Math.max(.3,.9-a.deviation_from_baseline_celsius*.03)];He(c,r);const p=(c[2]*50).toFixed(1),C=p>35?"Optimal":p>20?"Adequate":"Critical Low",g=document.getElementById("soil-moisture-val");g.innerText=`${p}% (${C})`,g.className=`data-value ${p<20?"red":p<35?"yellow":"green"}`;const h=Math.round(i.water_deliverable_m3/1e4);document.getElementById("irrigation-demand-val").innerText=`${h} m³/hectare`;const u=Math.round(o.humidity_percentage*.4),d=u>30?"High":u>15?"Medium":"Low",v=document.getElementById("disease-risk-val");v.innerText=`${d} (${u}%)`,v.className=`data-value ${u>30?"red":u>15?"yellow":"green"}`;const b=(1-i.water_irrigation_efficiency_pct/100).toFixed(2),L=b>.6?"Severe":b>.3?"Moderate":"Nominal",f=document.getElementById("water-stress-val");f.innerText=`${b} (${L})`,f.className=`data-value ${b>.6?"red":b>.3?"yellow":"green"}`;let I="";e.system_status==="CRITICAL_ANOMALY"?I=`CRITICAL WARNING: Temperature exceeded baseline by ${a.deviation_from_baseline_celsius}°C. High vapor pressure deficit of ${a.vapor_pressure_deficit_kpa} kPa detected. Immediately switch to sub-surface drip irrigation to prevent evaporative loss.`:e.system_status==="WARNING_ANOMALY"?I="ADVISORY: Moderate thermal stress. Soil moisture levels are declining. Shift irrigation schedules to early morning hours to optimize absorption and protect canopy transpiration.":I="SYSTEM NORMAL: Atmospheric conditions match the regional baseline. Maintain standard automated irrigation scheduling and track crop indices.",document.getElementById("ai-recommendation-text").innerText=I,document.getElementById("system-notification-text").innerText=`Weather models processed for ${e.region_name}. System status matches ${e.system_status} with current temperature at ${o.temperature_celsius}°C. Adjusting domain policies accordingly.`}async function pe(e){try{document.getElementById("agriculture-panel").classList.add("hidden"),document.getElementById("general-info-panel").classList.remove("hidden"),document.getElementById("left-sidebar").classList.add("visible");const t=await Q(S);if(!t)return;const a=document.getElementById("general-panel-title"),o=document.getElementById("general-panel-content"),i=document.getElementById("general-panel-icon");let n="";e==="globe-analysis"?(a.innerText="Globe Analysis Layers",i.setAttribute("data-lucide","layers"),n=`
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Thermographic Heatmap</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Continental surface anomalies</p>
                        </div>
                        <input type="checkbox" id="heatmap-toggle" ${V?"checked":""} onchange="window.__wiaas.toggleHeatmap()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Real-time Wind Flow</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Wind direction and speed vectors</p>
                        </div>
                        <input type="checkbox" id="wind-toggle" ${D?"checked":""} onchange="window.__wiaas.toggleWind()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Precipitation & Rain</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Relative humidity pulse indicators</p>
                        </div>
                        <input type="checkbox" id="rain-toggle" ${O?"checked":""} onchange="window.__wiaas.togglePrecipitation()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>
                    <div style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                        <h4 style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Zone Signals</h4>
                        <ul class="data-grid">
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Current Temperature</span>
                                <span class="data-value" style="font-size: 0.8rem;">${t.telemetry.temperature_celsius}°C</span>
                            </li>
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Wind Velocity</span>
                                <span class="data-value" style="font-size: 0.8rem;">${t.telemetry.wind_speed_kmh} km/h @ ${t.telemetry.wind_direction_degrees}°</span>
                            </li>
                            <li class="data-row" style="padding: 10px 0;">
                                <span class="data-label" style="font-size: 0.8rem;">Relative Humidity</span>
                                <span class="data-value" style="font-size: 0.8rem;">${t.telemetry.humidity_percentage}%</span>
                            </li>
                        </ul>
                    </div>
                </div>
            `):e==="region"?(a.innerText="Select Monitoring Region",i.setAttribute("data-lucide","globe"),n=`
                <div class="region-select-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    ${Object.entries(le).map(([s,r])=>`
                        <button class="region-select-btn ${s===S?"active":""}"
                                onclick="window.__wiaas.selectActiveRegion('${s}')"
                                style="background: ${s===S?"rgba(56, 189, 248, 0.15)":"rgba(255, 255, 255, 0.03)"};
                                       border: 1px solid ${s===S?"#38bdf8":"var(--border-color)"};
                                       color: ${s===S?"var(--text-primary)":"var(--text-secondary)"};
                                       text-align: left; padding: 12px 16px; border-radius: 8px; cursor: pointer;
                                       font-family: var(--font-ui); font-size: 0.85rem; font-weight: 500; transition: all 0.2s;">
                            ${r}
                        </button>
                    `).join("")}
                </div>
            `):e==="physics"?(a.innerText="Physics Intelligence",i.setAttribute("data-lucide","thermometer"),n=`
                <div class="kpi-section">
                    <div class="kpi-header">Vapor Pressure Deficit</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${t.climate_matrix.vapor_pressure_deficit_kpa}</span>
                        <span class="kpi-unit">kPa</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Heat Index</span>
                        <span class="data-value">${t.climate_matrix.heat_index_celsius}°C</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Wet-Bulb Temperature</span>
                        <span class="data-value">${t.climate_matrix.wet_bulb_celsius}°C</span>
                    </li>
                    <li class="data-row">
                        <span class="data-label">Deviation from Baseline</span>
                        <span class="data-value ${t.climate_matrix.deviation_from_baseline_celsius>0?"red":"green"}">
                            +${t.climate_matrix.deviation_from_baseline_celsius}°C
                        </span>
                    </li>
                </ul>
            `):e==="grid"?(a.innerText="Power Grid Status",i.setAttribute("data-lucide","zap"),n=`
                <div class="kpi-section">
                    <div class="kpi-header">Available Capacity</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${t.ledger.grid_available_capacity_mw}</span>
                        <span class="kpi-unit">MW</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Grid Demand Surge</span>
                        <span class="data-value red">+${t.ledger.grid_demand_surge_pct}%</span>
                    </li>
                </ul>
            `):e==="logistics"?(a.innerText="Logistics Reserves",i.setAttribute("data-lucide","truck"),n=`
                <div class="kpi-section">
                    <div class="kpi-header">Available Fuel Reserves</div>
                    <div class="kpi-value-row">
                        <span class="kpi-value">${t.ledger.fuel_available_liters.toLocaleString()}</span>
                        <span class="kpi-unit">Liters</span>
                    </div>
                </div>
                <ul class="data-grid" style="margin-top: 15px;">
                    <li class="data-row">
                        <span class="data-label">Thermal Fuel Overhead</span>
                        <span class="data-value red">+${t.ledger.fuel_thermal_overhead_pct}%</span>
                    </li>
                </ul>
            `):e==="research"&&(a.innerText="State Vector & Research",i.setAttribute("data-lucide","microscope"),n=`
                <div style="font-family: 'JetBrains Mono'; font-size: 0.7rem; white-space: pre-wrap;
                            background: rgba(0,0,0,0.4); border: 1px solid var(--border-color);
                            border-radius: 8px; padding: 10px; max-height: 250px; overflow-y: auto; color: #a5f3fc;">
${t.llm_state_vector}
                </div>
            `),o.innerHTML=n,lucide.createIcons()}catch(t){console.error("[ui] showGeneralInfoPanel failed:",t)}}function se(){const e=ce[S]??0,t=Date.now()+new Date().getTimezoneOffset()*6e4,o=new Date(t+36e5*e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}),i=document.getElementById("current-region-time");i&&(i.innerText=o)}function Oe(){setInterval(()=>{const e=(80+Math.random()*5).toFixed(1),t=(158+Math.random()*4).toFixed(1),a=Math.round(4200+Math.random()*200).toLocaleString(),o=(8+Math.random()*.8).toFixed(1),i=Math.round(640+Math.random()*25),n=Math.round(73+Math.random()*3);document.getElementById("cpu-util-val").innerText=`${e}%`,document.getElementById("vram-usage-val").innerText=`${t} / 192 GB`,document.getElementById("inf-speed-val").innerText=`${a} T/s`,document.getElementById("latency-val").innerText=`${o} ms`,document.getElementById("power-draw-val").innerText=`${i} W`,$e(i,n),Pe()},2e3)}async function oe(){const e=document.getElementById("chat-input"),t=document.getElementById("chat-messages-container"),a=e.value.trim();if(!a)return;const o=document.createElement("div");o.className="chat-message user-msg",o.innerHTML=`
        <div class="msg-header">
            <span class="user-tag">Operator</span>
            <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        <p class="msg-text">${ge(a)}</p>
    `,t.appendChild(o),e.value="",t.scrollTop=t.scrollHeight;const i="loading-"+Date.now(),n=document.createElement("div");n.id=i,n.className="chat-message agent-msg",n.innerHTML=`
        <div class="msg-header">
            <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0</span>
            <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        <p class="msg-text" style="opacity: 0.7;"><em>Contacting n8n AI Swarm...</em></p>
    `,t.appendChild(n),lucide.createIcons(),t.scrollTop=t.scrollHeight;try{const s=await Ne(S,a),r=document.getElementById(i);if(r&&r.remove(),!s)throw new Error("No response from backend");const c=document.createElement("div");c.className="chat-message agent-msg",c.innerHTML=`
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0 (n8n)</span>
                <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p class="msg-text">${Ge(s.reply)}</p>
        `,t.appendChild(c),lucide.createIcons(),t.scrollTop=t.scrollHeight}catch(s){console.error("[chat] handleUserMessage failed:",s);const r=document.getElementById(i);r&&r.remove();const c=document.createElement("div");c.className="chat-message agent-msg",c.innerHTML=`
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="alert-triangle"></i> System Error</span>
                <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p class="msg-text" style="color: #ef4444;">Connection to n8n webhook failed. Check backend logs.</p>
        `,t.appendChild(c),lucide.createIcons(),t.scrollTop=t.scrollHeight}}function Ge(e){return e?ge(e).replace(/\\n/g,"<br>").replace(/\n/g,"<br>"):""}function ge(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Fe(){document.getElementById("toggle-left-dock").addEventListener("click",()=>{const i=document.getElementById("left-sidebar"),n=document.getElementById("left-dock-icon"),s=i.classList.toggle("visible");n.setAttribute("data-lucide",s?"chevron-left":"chevron-right"),lucide.createIcons()}),document.getElementById("toggle-right-dock").addEventListener("click",()=>{const i=document.getElementById("right-sidebar"),n=document.getElementById("right-dock-icon"),s=i.classList.toggle("visible");n.setAttribute("data-lucide",s?"chevron-right":"chevron-left"),lucide.createIcons()}),document.getElementById("refresh-data-btn").addEventListener("click",()=>{ee(S)}),document.getElementById("close-left-panel").addEventListener("click",()=>{q()}),document.getElementById("close-general-panel").addEventListener("click",()=>{q()}),document.getElementById("close-right-panel").addEventListener("click",()=>{const i=document.getElementById("right-sidebar"),n=document.getElementById("right-dock-icon");i.classList.remove("visible"),n.setAttribute("data-lucide","chevron-left"),document.querySelectorAll(".nav-item").forEach(s=>s.classList.remove("active")),lucide.createIcons()}),document.getElementById("toggle-bottom-panel").addEventListener("click",()=>{const i=document.getElementById("bottom-panel"),n=document.getElementById("bottom-toggle-icon"),s=i.classList.toggle("collapsed");n.setAttribute("data-lucide",s?"chevron-up":"chevron-down"),lucide.createIcons()});const e=document.querySelectorAll(".nav-item");e.forEach(i=>{i.addEventListener("click",()=>{const n=i.getAttribute("data-tab"),s=i.classList.contains("active");if(["region","physics","agriculture","grid","logistics","research","globe-analysis"].includes(n))s?(i.classList.remove("active"),q()):(e.forEach(r=>r.classList.remove("active")),i.classList.add("active"),document.getElementById("left-sidebar").classList.add("visible"),document.getElementById("left-dock-icon").setAttribute("data-lucide","chevron-left"),n==="agriculture"?(document.getElementById("agriculture-panel").classList.remove("hidden"),document.getElementById("general-info-panel").classList.add("hidden")):(document.getElementById("agriculture-panel").classList.add("hidden"),document.getElementById("general-info-panel").classList.remove("hidden"),pe(n)),lucide.createIcons());else if(n==="agents")s?(i.classList.remove("active"),document.getElementById("right-sidebar").classList.remove("visible"),document.getElementById("right-dock-icon").setAttribute("data-lucide","chevron-left")):(e.forEach(r=>r.classList.remove("active")),i.classList.add("active"),document.getElementById("right-sidebar").classList.add("visible"),document.getElementById("right-dock-icon").setAttribute("data-lucide","chevron-right"),document.getElementById("bottom-panel").classList.remove("collapsed"),document.getElementById("bottom-toggle-icon").setAttribute("data-lucide","chevron-down")),lucide.createIcons();else if(n==="analytics"){const r=document.getElementById("bottom-panel"),c=document.getElementById("bottom-toggle-icon"),p=r.classList.toggle("collapsed");c.setAttribute("data-lucide",p?"chevron-up":"chevron-down"),lucide.createIcons()}})});const t=document.getElementById("chat-input"),a=document.getElementById("send-chat-btn"),o=document.getElementById("clear-chat");a.addEventListener("click",oe),t.addEventListener("keydown",i=>{i.key==="Enter"&&oe()}),o.addEventListener("click",()=>{document.getElementById("chat-messages-container").innerHTML=""})}async function ee(e){const t=await Q(e);t&&(K[e]=t,H(),De(t))}async function Ve(e){(await ze(e)).forEach((a,o)=>{K[o]=a}),H()}function je(e){re(e),ee(e),pe("region")}function q(){document.getElementById("left-sidebar").classList.remove("visible");const e=document.getElementById("left-dock-icon");e&&e.setAttribute("data-lucide","chevron-right"),document.querySelectorAll(".nav-item").forEach(t=>t.classList.remove("active")),lucide.createIcons()}async function We(){y.loadFromDisk("wiaas_selected_cities"),ye(),Ue(),Ye()}function Ue(){const e=document.getElementById("left-sidebar");if(!e||document.getElementById("city-search-panel"))return;const t=document.createElement("div");t.id="city-search-panel",t.className="panel-card city-search-card",t.innerHTML=`
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
    `;const a=e.querySelector(".panel-card");a?e.insertBefore(t,a):e.appendChild(t),typeof lucide<"u"&&lucide.createIcons()}function Ye(){const e=document.getElementById("city-search-input"),t=document.getElementById("city-search-btn"),a=document.getElementById("city-clear-all-btn"),o=document.getElementById("city-refresh-globe-btn"),i=document.getElementById("toggle-city-panel");if(i==null||i.addEventListener("click",()=>{const s=document.getElementById("city-search-panel"),r=i.querySelector("i"),c=s.classList.toggle("collapsed");r&&r.setAttribute("data-lucide",c?"chevron-down":"chevron-right"),typeof lucide<"u"&&lucide.createIcons()}),!e)return;t==null||t.addEventListener("click",()=>X()),e.addEventListener("keypress",s=>{s.key==="Enter"&&X()});let n;e.addEventListener("input",()=>{if(clearTimeout(n),e.value.trim().length<2){const r=document.getElementById("city-search-results");r&&(r.classList.add("hidden"),r.innerHTML="");return}n=setTimeout(()=>{X()},300)}),a==null||a.addEventListener("click",async()=>{confirm("Clear all selected cities?")&&(y.clearAllCities(),y.saveToDisk("wiaas_selected_cities"),Y(),await H(y.getAllCities()))}),o==null||o.addEventListener("click",async()=>{const s=y.getAllCities();if(s.length===0){alert("No cities selected. Search and add cities first.");return}await H(s),console.log("[ui-cities] Globe updated with",s.length,"cities")}),Y()}async function X(){var o;const e=document.getElementById("city-search-input"),t=(o=e==null?void 0:e.value)==null?void 0:o.trim();if(!t||t.length<2)return;const a=document.getElementById("city-search-results");if(a){a.classList.remove("hidden"),a.innerHTML='<p class="search-loading">Searching...</p>';try{const i=await y.searchCities(t,10);if(i.length===0){a.innerHTML='<p class="search-no-results">No cities found. Try a different search.</p>';return}a.innerHTML=i.map((n,s)=>`
            <div class="city-result-item" data-index="${s}">
                <div class="city-result-info">
                    <div class="city-result-name">${Z(n.name)}</div>
                    <div class="city-result-details">${Z(n.displayName)}</div>
                </div>
                <button class="city-result-add-btn" data-city-index="${s}" title="Add this city">
                    <i data-lucide="plus"></i>
                </button>
            </div>
        `).join(""),typeof lucide<"u"&&lucide.createIcons(),a.querySelectorAll(".city-result-add-btn").forEach(n=>{n.addEventListener("click",async()=>{const s=parseInt(n.dataset.cityIndex),r=i[s];y.addCity(r)?(y.saveToDisk("wiaas_selected_cities"),de(r),Y(),e.value="",a.classList.add("hidden"),await H(y.getAllCities()),console.log("[ui-cities] Added city:",r.name)):alert("City already added or limit reached.")})})}catch(i){console.error("[ui-cities] Search error:",i),a.innerHTML='<p class="search-error">Search failed. Please try again.</p>'}}}function Y(){const e=document.getElementById("city-selected-list");if(!e)return;const t=y.getAllCities();if(t.length===0){e.innerHTML='<p class="city-list-empty">No cities selected. Search above to add.</p>';return}e.innerHTML=t.map((a,o)=>`
        <div class="city-item" data-city-id="${a.id}">
            <div class="city-item-info">
                <div class="city-item-name">${Z(a.name)}</div>
                <div class="city-item-coords">${a.latitude.toFixed(2)}°, ${a.longitude.toFixed(2)}°</div>
            </div>
            <div class="city-item-actions">
                <button class="city-item-select-btn" data-city-id="${a.id}" title="Select as active">
                    <i data-lucide="target"></i>
                </button>
                <button class="city-item-remove-btn" data-city-id="${a.id}" title="Remove">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `).join(""),typeof lucide<"u"&&lucide.createIcons(),e.querySelectorAll(".city-item-remove-btn").forEach(a=>{a.addEventListener("click",async()=>{const o=a.dataset.cityId;y.removeCity(o),y.saveToDisk("wiaas_selected_cities"),Y(),await H(y.getAllCities())})}),e.querySelectorAll(".city-item-select-btn").forEach(a=>{a.addEventListener("click",()=>{const o=a.dataset.cityId,i=t.find(n=>n.id===o);if(i){re(i.id);const n=new CustomEvent("citySelected",{detail:{cityId:o,city:i}});document.dispatchEvent(n),console.log("[ui-cities] Selected city:",i.name)}})})}function Z(e){const t={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"};return e.replace(/[&<>"']/g,a=>t[a])}window.__wiaas={toggleHeatmap:Ae,toggleWind:ke,togglePrecipitation:Re,selectActiveRegion:je};window.closeGlobePopup=function(){const e=document.getElementById("globe-popup-overlay");e&&e.classList.add("hidden")};document.addEventListener("DOMContentLoaded",async()=>{const e=Date.now();lucide.createIcons(),await We(),Se(),Be(),Fe(),await ee("pakistan_punjab"),Ve(W),Oe(),se(),setInterval(se,1e3),lucide.createIcons();const t=Date.now()-e,a=1800;t<a&&await new Promise(i=>setTimeout(i,a-t));const o=document.getElementById("loading-screen");o&&(o.classList.add("zoom-out"),await new Promise(i=>setTimeout(i,100)),o.classList.add("fade-out"),setTimeout(()=>o.remove(),1200)),document.addEventListener("citySelected",i=>{const{cityId:n,city:s}=i.detail;console.log("[main] City selected:",s)})});
