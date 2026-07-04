(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))o(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const s of n.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function i(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(a){if(a.ep)return;a.ep=!0;const n=i(a);fetch(a.href,n)}})();let _="pakistan_punjab";function q(e){_=e}const D=["pakistan_punjab","togo_maritime","france_paris","spain_andalusia","germany_bavaria","uk_london","italy_sicily","usa_california_central_valley","usa_texas_houston","brazil_cerrado","canada_alberta","argentina_pampas"],J={pakistan_punjab:5,togo_maritime:0,france_paris:2,spain_andalusia:2,germany_bavaria:2,uk_london:1,italy_sicily:2,usa_california_central_valley:-7,usa_texas_houston:-5,brazil_cerrado:-3,canada_alberta:-6,argentina_pampas:-3},X={pakistan_punjab:"Punjab Region, Pakistan",togo_maritime:"Maritime Region, Togo",france_paris:"Paris, France",spain_andalusia:"Andalusia, Spain",germany_bavaria:"Bavaria, Germany",uk_london:"Greater London, UK",italy_sicily:"Sicily, Italy",usa_california_central_valley:"Central Valley, California",usa_texas_houston:"Houston, Texas",brazil_cerrado:"Cerrado Savannah, Brazil",canada_alberta:"Alberta Plains, Canada",argentina_pampas:"The Pampas, Argentina"},N={};let $=!0,R=!1,C=!1;function Z(e){$=e}function K(e){R=e}function Q(e){C=e}const ee={pakistan_punjab:{lat:31.17,lon:72.7},togo_maritime:{lat:6.13,lon:1.22},france_paris:{lat:48.85,lon:2.35},spain_andalusia:{lat:37.38,lon:-5.98},germany_bavaria:{lat:48.79,lon:11.49},uk_london:{lat:51.5,lon:-.12},italy_sicily:{lat:37.6,lon:14.01},usa_california_central_valley:{lat:36.77,lon:-119.41},usa_texas_houston:{lat:29.76,lon:-95.36},brazil_cerrado:{lat:-14.23,lon:-51.92},canada_alberta:{lat:53.93,lon:-116.57},argentina_pampas:{lat:-34.6,lon:-58.38}},te=`
    varying vec2 vUv;
    varying vec3 vLocalPosition;
    void main() {
        vUv = uv;
        vLocalPosition = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,ae=`
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
`,ne=`
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,ie=`
    varying vec3 vNormal;
    void main() {
        float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
        gl_FragColor = vec4(0.2, 0.55, 1.0, 1.0) * intensity;
    }
`;let T,H,k,v,M,O,L,A=[],B=[];function se(){const e=document.getElementById("globe-container"),t=e.clientWidth,i=e.clientHeight;T=new THREE.Scene,T.background=null,H=new THREE.PerspectiveCamera(45,t/i,.1,1e3),H.position.z=4.5,k=new THREE.WebGLRenderer({antialias:!0,alpha:!0}),k.setSize(t,i),k.setPixelRatio(window.devicePixelRatio),e.appendChild(k.domElement);const o=new THREE.DirectionalLight(16777215,1.6);o.position.set(5,3,5),T.add(o),T.add(new THREE.AmbientLight(1122867,.35));const a=new THREE.TextureLoader,n=a.load("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"),s=a.load("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg"),r=a.load("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg"),l=a.load("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_2048.png"),m={specularMap:{value:r},regionPos:{value:new Float32Array(36)},regionTemp:{value:new Float32Array(12)}};L=new THREE.ShaderMaterial({uniforms:m,vertexShader:te,fragmentShader:ae,transparent:!0,opacity:.95}),O=new THREE.MeshPhongMaterial({map:n,normalMap:s,normalScale:new THREE.Vector2(.6,.6),specularMap:r,shininess:18,specular:new THREE.Color(2245734)}),v=new THREE.Mesh(new THREE.SphereGeometry(1.6,64,64),$?L:O),T.add(v);const x=new THREE.Mesh(new THREE.SphereGeometry(1.625,48,48),new THREE.MeshPhongMaterial({map:l,alphaMap:l,transparent:!0,opacity:.42,depthWrite:!1}));T.add(x),v.userData.cloudSphere=x,T.add(new THREE.Mesh(new THREE.SphereGeometry(1.68,48,48),new THREE.ShaderMaterial({vertexShader:ne,fragmentShader:ie,blending:THREE.AdditiveBlending,side:THREE.BackSide,transparent:!0}))),M=new THREE.Group,v.add(M),V();let y=!1,h={x:0,y:0},c={x:0,y:0};e.addEventListener("mousedown",d=>{y=!0,h={x:d.clientX,y:d.clientY}}),e.addEventListener("mousemove",d=>{y&&(c.y+=(d.clientX-h.x)*.005,c.x+=(d.clientY-h.y)*.005,c.x=Math.max(-Math.PI/3,Math.min(Math.PI/3,c.x)),h={x:d.clientX,y:d.clientY})}),window.addEventListener("mouseup",()=>{y=!1});let b=0,E=0;function u(){requestAnimationFrame(u),E+=.05,b+=.0012,v.rotation.y=b+c.y,v.rotation.x=c.x;const d=v.userData.cloudSphere;d&&(d.rotation.y=b*1.08+c.y,d.rotation.x=c.x),C&&B.length>0&&B.forEach((p,g)=>{const w=1+Math.abs(Math.sin(E+g))*.8;p.scale.set(w,w,1)}),R&&A.length>0&&A.forEach((p,g)=>{const w=.8+Math.sin(E*1.5+g)*.2;p.setLength(.35*w,.08*w,.04*w)}),document.getElementById("globe-popup-overlay"),k.render(T,H)}u(),window.addEventListener("resize",()=>{const d=e.clientWidth,p=e.clientHeight;H.aspect=d/p,H.updateProjectionMatrix(),k.setSize(d,p)})}function V(){A.forEach(i=>M.remove(i)),B.forEach(i=>M.remove(i)),M.clear(),A=[],B=[];const e=new Float32Array(36),t=new Float32Array(12);D.forEach((i,o)=>{const a=N[i],n=ee[i];if(!n)return;let s=20,r=10,l=0,m=50;a&&(s=a.telemetry.temperature_celsius,r=a.telemetry.wind_speed_kmh,l=a.telemetry.wind_direction_degrees,m=a.telemetry.humidity_percentage);const x=(90-n.lat)*(Math.PI/180),y=(n.lon+180)*(Math.PI/180),h=1.6*Math.sin(x)*Math.sin(y),c=1.6*Math.cos(x),b=1.6*Math.sin(x)*Math.cos(y);e[o*3]=h,e[o*3+1]=c,e[o*3+2]=b,t[o]=Math.max(0,Math.min(1,(s+5)/50));const E=new THREE.Vector3(h,c,b),u=E.clone().normalize(),d=new THREE.Vector3(0,1,0).projectOnPlane(u).normalize(),p=u.clone().cross(new THREE.Vector3(0,1,0)).normalize(),g=l*Math.PI/180,w=d.clone().multiplyScalar(Math.cos(g)).add(p.clone().multiplyScalar(Math.sin(g))).normalize(),P=new THREE.ArrowHelper(w,E,.15+r/60*.35,3718648,.08,.04);P.visible=R,M.add(P),A.push(P);const S=new THREE.Mesh(new THREE.RingGeometry(.08,.11,16),new THREE.MeshBasicMaterial({color:58879,side:THREE.DoubleSide,transparent:!0,opacity:m/100*.8}));S.position.set(h,c,b),S.lookAt(0,0,0),S.visible=C&&m>60,M.add(S),B.push(S)}),L&&L.uniforms&&(L.uniforms.regionPos.value=e,L.uniforms.regionTemp.value=t)}function oe(){Z(!$),v&&(v.material=$?L:O,v.material.needsUpdate=!0)}function re(){K(!R),A.forEach(e=>{e.visible=R})}function le(){Q(!C),B.forEach(e=>{e.visible=C})}let f=null,I=null;function ce(){const e=document.getElementById("radarChart").getContext("2d");f=new Chart(e,{type:"radar",data:{labels:["Transpiration","NDVI Index","Soil Moisture","Canopy Cover","Nitrogen Level"],datasets:[{label:"Index Value",data:[.72,.82,.65,.55,.7],backgroundColor:"rgba(16, 185, 129, 0.2)",borderColor:"#10b981",borderWidth:2,pointBackgroundColor:"#10b981",pointBorderColor:"#fff",pointHoverBackgroundColor:"#fff",pointHoverBorderColor:"#10b981"}]},options:{responsive:!0,maintainAspectRatio:!1,scales:{r:{angleLines:{color:"rgba(255, 255, 255, 0.1)"},grid:{color:"rgba(255, 255, 255, 0.1)"},pointLabels:{color:"#9090a0",font:{family:"Outfit",size:9}},ticks:{display:!1},suggestedMin:0,suggestedMax:1}},plugins:{legend:{display:!1}}}});const t=document.getElementById("vramChart").getContext("2d");new Chart(t,{type:"bar",data:{labels:["Agri-Agent","Grid-Agent","Logistics","Regulator","Base Swarm"],datasets:[{data:[32,28,42,18,40.5],backgroundColor:["rgba(56, 189, 248, 0.4)","rgba(56, 189, 248, 0.4)","rgba(56, 189, 248, 0.6)","rgba(56, 189, 248, 0.4)","rgba(56, 189, 248, 0.7)"],borderColor:"#38bdf8",borderWidth:1,borderRadius:4}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{x:{grid:{display:!1},ticks:{color:"#9090a0",font:{family:"Outfit",size:9}}},y:{grid:{color:"rgba(255, 255, 255, 0.05)"},ticks:{color:"#9090a0",font:{family:"JetBrains Mono",size:9}},suggestedMax:50}}}});const i=document.getElementById("tempPowerChart").getContext("2d");I=new Chart(i,{type:"line",data:{labels:["10s ago","8s ago","6s ago","4s ago","2s ago","Now"],datasets:[{label:"Power Draw (W)",data:[610,620,605,630,642,656],borderColor:"#38bdf8",backgroundColor:"transparent",borderWidth:2,tension:.3,yAxisID:"yPower"},{label:"Core Temp (°C)",data:[72,73,72,74,75,75],borderColor:"#ef4444",backgroundColor:"transparent",borderWidth:2,tension:.3,yAxisID:"yTemp"}]},options:{responsive:!0,maintainAspectRatio:!1,plugins:{legend:{display:!1}},scales:{x:{grid:{display:!1},ticks:{color:"#9090a0",font:{family:"Outfit",size:9}}},yPower:{type:"linear",position:"left",grid:{color:"rgba(255, 255, 255, 0.05)"},ticks:{color:"#38bdf8",font:{family:"JetBrains Mono",size:9}}},yTemp:{type:"linear",position:"right",grid:{display:!1},ticks:{color:"#ef4444",font:{family:"JetBrains Mono",size:9}}}}}})}function de(e,t){f&&(f.data.datasets[0].data=e,t>.7?(f.data.datasets[0].borderColor="#10b981",f.data.datasets[0].backgroundColor="rgba(16, 185, 129, 0.2)"):t>.5?(f.data.datasets[0].borderColor="#f59e0b",f.data.datasets[0].backgroundColor="rgba(245, 158, 11, 0.2)"):(f.data.datasets[0].borderColor="#ef4444",f.data.datasets[0].backgroundColor="rgba(239, 68, 68, 0.2)"),f.update())}function me(e,t){I&&(I.data.datasets[0].data.shift(),I.data.datasets[0].data.push(e),I.data.datasets[1].data.shift(),I.data.datasets[1].data.push(t),I.update("none"))}async function j(e){try{const t=await fetch(`/analytics/${e}`);if(!t.ok)throw new Error(`HTTP ${t.status}`);return await t.json()}catch(t){return console.error(`[api] fetchRegionAnalytics(${e}) failed:`,t),null}}async function ue(e){const t=new Map;return await Promise.all(e.map(async i=>{const o=await j(i);o&&t.set(i,o)})),t}async function pe(e,t){try{const i=await fetch(`/analytics/${e}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:t})});if(!i.ok)throw new Error(`HTTP ${i.status}`);return await i.json()}catch(i){return console.error(`[api] sendChatSimulation(${e}) failed:`,i),null}}function ge(e){const t=document.getElementById("current-region-name");t&&(t.innerText=e.region_name);const i=e.climate_matrix,o=e.telemetry,a=e.ledger,n=document.getElementById("crop-health-status");n.innerText=e.system_status.replace(/_/g," "),n.className="kpi-status",e.system_status==="HEALTHY"?n.classList.add("green"):e.system_status==="ADVISORY"?n.classList.add("yellow"):n.classList.add("red");const s=Math.max(0,i.deviation_from_baseline_celsius*.05)+Math.max(0,(i.wet_bulb_celsius-25)*.02),r=Math.max(.12,.85-s);document.getElementById("crop-health-value").innerText=r.toFixed(2);const l=[Math.max(.1,.85-i.vapor_pressure_deficit_kpa*.15),parseFloat(r.toFixed(2)),Math.max(.1,.75-i.vapor_pressure_deficit_kpa*.12),Math.max(.2,.8-s*.5),Math.max(.3,.9-i.deviation_from_baseline_celsius*.03)];de(l,r);const m=(l[2]*50).toFixed(1),x=m>35?"Optimal":m>20?"Adequate":"Critical Low",y=document.getElementById("soil-moisture-val");y.innerText=`${m}% (${x})`,y.className=`data-value ${m<20?"red":m<35?"yellow":"green"}`;const h=Math.round(a.water_deliverable_m3/1e4);document.getElementById("irrigation-demand-val").innerText=`${h} m³/hectare`;const c=Math.round(o.humidity_percentage*.4),b=c>30?"High":c>15?"Medium":"Low",E=document.getElementById("disease-risk-val");E.innerText=`${b} (${c}%)`,E.className=`data-value ${c>30?"red":c>15?"yellow":"green"}`;const u=(1-a.water_irrigation_efficiency_pct/100).toFixed(2),d=u>.6?"Severe":u>.3?"Moderate":"Nominal",p=document.getElementById("water-stress-val");p.innerText=`${u} (${d})`,p.className=`data-value ${u>.6?"red":u>.3?"yellow":"green"}`;let g="";e.system_status==="CRITICAL_ANOMALY"?g=`CRITICAL WARNING: Temperature exceeded baseline by ${i.deviation_from_baseline_celsius}°C. High vapor pressure deficit of ${i.vapor_pressure_deficit_kpa} kPa detected. Immediately switch to sub-surface drip irrigation to prevent evaporative loss.`:e.system_status==="WARNING_ANOMALY"?g="ADVISORY: Moderate thermal stress. Soil moisture levels are declining. Shift irrigation schedules to early morning hours to optimize absorption and protect canopy transpiration.":g="SYSTEM NORMAL: Atmospheric conditions match the regional baseline. Maintain standard automated irrigation scheduling and track crop indices.",document.getElementById("ai-recommendation-text").innerText=g,document.getElementById("system-notification-text").innerText=`Weather models processed for ${e.region_name}. System status matches ${e.system_status} with current temperature at ${o.temperature_celsius}°C. Adjusting domain policies accordingly.`}async function U(e){try{const t=await j(_);if(!t)return;const i=document.getElementById("general-panel-title"),o=document.getElementById("general-panel-content"),a=document.getElementById("general-panel-icon");document.getElementById("agriculture-panel").classList.add("hidden"),document.getElementById("general-info-panel").classList.remove("hidden"),document.getElementById("left-sidebar").classList.add("visible");let n="";e==="globe-analysis"?(i.innerText="Globe Analysis Layers",a.setAttribute("data-lucide","layers"),n=`
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Thermographic Heatmap</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Continental surface anomalies</p>
                        </div>
                        <input type="checkbox" id="heatmap-toggle" ${$?"checked":""} onchange="window.__wiaas.toggleHeatmap()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Real-time Wind Flow</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Wind direction and speed vectors</p>
                        </div>
                        <input type="checkbox" id="wind-toggle" ${R?"checked":""} onchange="window.__wiaas.toggleWind()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px;">
                        <div>
                            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Precipitation & Rain</h4>
                            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">Relative humidity pulse indicators</p>
                        </div>
                        <input type="checkbox" id="rain-toggle" ${C?"checked":""} onchange="window.__wiaas.togglePrecipitation()" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-color);">
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
            `):e==="region"?(i.innerText="Select Monitoring Region",a.setAttribute("data-lucide","globe"),n=`
                <div class="region-select-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
                    ${Object.entries(X).map(([s,r])=>`
                        <button class="region-select-btn ${s===_?"active":""}"
                                onclick="window.__wiaas.selectActiveRegion('${s}')"
                                style="background: ${s===_?"rgba(56, 189, 248, 0.15)":"rgba(255, 255, 255, 0.03)"};
                                       border: 1px solid ${s===_?"#38bdf8":"var(--border-color)"};
                                       color: ${s===_?"var(--text-primary)":"var(--text-secondary)"};
                                       text-align: left; padding: 12px 16px; border-radius: 8px; cursor: pointer;
                                       font-family: var(--font-ui); font-size: 0.85rem; font-weight: 500; transition: all 0.2s;">
                            ${r}
                        </button>
                    `).join("")}
                </div>
            `):e==="physics"?(i.innerText="Physics Intelligence",a.setAttribute("data-lucide","thermometer"),n=`
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
            `):e==="grid"?(i.innerText="Power Grid Status",a.setAttribute("data-lucide","zap"),n=`
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
            `):e==="logistics"?(i.innerText="Logistics Reserves",a.setAttribute("data-lucide","truck"),n=`
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
            `):e==="research"&&(i.innerText="State Vector & Research",a.setAttribute("data-lucide","microscope"),n=`
                <div style="font-family: 'JetBrains Mono'; font-size: 0.7rem; white-space: pre-wrap;
                            background: rgba(0,0,0,0.4); border: 1px solid var(--border-color);
                            border-radius: 8px; padding: 10px; max-height: 250px; overflow-y: auto; color: #a5f3fc;">
${t.llm_state_vector}
                </div>
            `),o.innerHTML=n,lucide.createIcons()}catch(t){console.error("[ui] showGeneralInfoPanel failed:",t)}}function F(){const e=J[_]??0,t=Date.now()+new Date().getTimezoneOffset()*6e4,o=new Date(t+36e5*e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}),a=document.getElementById("current-region-time");a&&(a.innerText=o)}function he(){setInterval(()=>{const e=(80+Math.random()*5).toFixed(1),t=(158+Math.random()*4).toFixed(1),i=Math.round(4200+Math.random()*200).toLocaleString(),o=(8+Math.random()*.8).toFixed(1),a=Math.round(640+Math.random()*25),n=Math.round(73+Math.random()*3);document.getElementById("cpu-util-val").innerText=`${e}%`,document.getElementById("vram-usage-val").innerText=`${t} / 192 GB`,document.getElementById("inf-speed-val").innerText=`${i} T/s`,document.getElementById("latency-val").innerText=`${o} ms`,document.getElementById("power-draw-val").innerText=`${a} W`,me(a,n)},2e3)}async function W(){const e=document.getElementById("chat-input"),t=document.getElementById("chat-messages-container"),i=e.value.trim();if(!i)return;const o=document.createElement("div");o.className="chat-message user-msg",o.innerHTML=`
        <div class="msg-header">
            <span class="user-tag">Operator</span>
            <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        <p class="msg-text">${Y(i)}</p>
    `,t.appendChild(o),e.value="",t.scrollTop=t.scrollHeight;const a="loading-"+Date.now(),n=document.createElement("div");n.id=a,n.className="chat-message agent-msg",n.innerHTML=`
        <div class="msg-header">
            <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0</span>
            <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        <p class="msg-text" style="opacity: 0.7;"><em>Contacting n8n AI Swarm...</em></p>
    `,t.appendChild(n),lucide.createIcons(),t.scrollTop=t.scrollHeight;try{const s=await pe(_,i),r=document.getElementById(a);if(r&&r.remove(),!s)throw new Error("No response from backend");const l=document.createElement("div");l.className="chat-message agent-msg",l.innerHTML=`
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="cpu"></i> WIaaS-SWARM-V1.0 (n8n)</span>
                <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p class="msg-text">${fe(s.reply)}</p>
        `,t.appendChild(l),lucide.createIcons(),t.scrollTop=t.scrollHeight}catch(s){console.error("[chat] handleUserMessage failed:",s);const r=document.getElementById(a);r&&r.remove();const l=document.createElement("div");l.className="chat-message agent-msg",l.innerHTML=`
            <div class="msg-header">
                <span class="agent-tag"><i data-lucide="alert-triangle"></i> System Error</span>
                <span class="msg-time">${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <p class="msg-text" style="color: #ef4444;">Connection to n8n webhook failed. Check backend logs.</p>
        `,t.appendChild(l),lucide.createIcons(),t.scrollTop=t.scrollHeight}}function fe(e){return e?Y(e).replace(/\\n/g,"<br>").replace(/\n/g,"<br>"):""}function Y(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function ve(){document.getElementById("toggle-left-dock").addEventListener("click",()=>{const a=document.getElementById("left-sidebar"),n=document.getElementById("left-dock-icon"),s=a.classList.toggle("visible");n.setAttribute("data-lucide",s?"chevron-left":"chevron-right"),lucide.createIcons()}),document.getElementById("toggle-right-dock").addEventListener("click",()=>{const a=document.getElementById("right-sidebar"),n=document.getElementById("right-dock-icon"),s=a.classList.toggle("visible");n.setAttribute("data-lucide",s?"chevron-right":"chevron-left"),lucide.createIcons()}),document.getElementById("refresh-data-btn").addEventListener("click",()=>{G(_)}),document.getElementById("close-left-panel").addEventListener("click",()=>{z()}),document.getElementById("close-general-panel").addEventListener("click",()=>{z()}),document.getElementById("close-right-panel").addEventListener("click",()=>{const a=document.getElementById("right-sidebar"),n=document.getElementById("right-dock-icon");a.classList.remove("visible"),n.setAttribute("data-lucide","chevron-left"),document.querySelectorAll(".nav-item").forEach(s=>s.classList.remove("active")),lucide.createIcons()}),document.getElementById("toggle-bottom-panel").addEventListener("click",()=>{const a=document.getElementById("bottom-panel"),n=document.getElementById("bottom-toggle-icon"),s=a.classList.toggle("collapsed");n.setAttribute("data-lucide",s?"chevron-up":"chevron-down"),lucide.createIcons()});const e=document.querySelectorAll(".nav-item");e.forEach(a=>{a.addEventListener("click",()=>{const n=a.getAttribute("data-tab"),s=a.classList.contains("active");if(["region","physics","agriculture","grid","logistics","research","globe-analysis"].includes(n))s?(a.classList.remove("active"),z()):(e.forEach(r=>r.classList.remove("active")),a.classList.add("active"),document.getElementById("left-sidebar").classList.add("visible"),document.getElementById("left-dock-icon").setAttribute("data-lucide","chevron-left"),n==="agriculture"?(document.getElementById("agriculture-panel").classList.remove("hidden"),document.getElementById("general-info-panel").classList.add("hidden")):U(n),lucide.createIcons());else if(n==="agents")s?(a.classList.remove("active"),document.getElementById("right-sidebar").classList.remove("visible"),document.getElementById("right-dock-icon").setAttribute("data-lucide","chevron-left")):(e.forEach(r=>r.classList.remove("active")),a.classList.add("active"),document.getElementById("right-sidebar").classList.add("visible"),document.getElementById("right-dock-icon").setAttribute("data-lucide","chevron-right"),document.getElementById("bottom-panel").classList.remove("collapsed"),document.getElementById("bottom-toggle-icon").setAttribute("data-lucide","chevron-down")),lucide.createIcons();else if(n==="analytics"){const r=document.getElementById("bottom-panel"),l=document.getElementById("bottom-toggle-icon"),m=r.classList.toggle("collapsed");l.setAttribute("data-lucide",m?"chevron-up":"chevron-down"),lucide.createIcons()}})});const t=document.getElementById("chat-input"),i=document.getElementById("send-chat-btn"),o=document.getElementById("clear-chat");i.addEventListener("click",W),t.addEventListener("keydown",a=>{a.key==="Enter"&&W()}),o.addEventListener("click",()=>{document.getElementById("chat-messages-container").innerHTML=""})}async function G(e){const t=await j(e);t&&(N[e]=t,V(),ge(t))}async function ye(e){(await ue(e)).forEach((i,o)=>{N[o]=i}),V()}function be(e){q(e),G(e),U("region")}function z(){document.getElementById("left-sidebar").classList.remove("visible");const e=document.getElementById("left-dock-icon");e&&e.setAttribute("data-lucide","chevron-right"),document.querySelectorAll(".nav-item").forEach(t=>t.classList.remove("active")),lucide.createIcons()}window.__wiaas={toggleHeatmap:oe,toggleWind:re,togglePrecipitation:le,selectActiveRegion:be};document.addEventListener("DOMContentLoaded",async()=>{lucide.createIcons(),se(),ce(),ve(),await G("pakistan_punjab"),ye(D),he(),F(),setInterval(F,1e3)});
