var Module=typeof pyodide._module!=="undefined"?pyodide._module:{};Module.checkABI(1);if(!Module.expectedDataFileDownloads){Module.expectedDataFileDownloads=0;Module.finishedDataFileDownloads=0}Module.expectedDataFileDownloads++;(function(){var loadPackage=function(metadata){var PACKAGE_PATH;if(typeof window==="object"){PACKAGE_PATH=window["encodeURIComponent"](window.location.pathname.toString().substring(0,window.location.pathname.toString().lastIndexOf("/"))+"/")}else if(typeof location!=="undefined"){PACKAGE_PATH=encodeURIComponent(location.pathname.toString().substring(0,location.pathname.toString().lastIndexOf("/"))+"/")}else{throw"using preloaded data can only be done on a web page or in a web worker"}var PACKAGE_NAME="space-tracer.data";var REMOTE_PACKAGE_BASE="space-tracer.data";if(typeof Module["locateFilePackage"]==="function"&&!Module["locateFile"]){Module["locateFile"]=Module["locateFilePackage"];err("warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)")}var REMOTE_PACKAGE_NAME=Module["locateFile"]?Module["locateFile"](REMOTE_PACKAGE_BASE,""):REMOTE_PACKAGE_BASE;var REMOTE_PACKAGE_SIZE=metadata.remote_package_size;var PACKAGE_UUID=metadata.package_uuid;function fetchRemotePackage(packageName,packageSize,callback,errback){var xhr=new XMLHttpRequest;xhr.open("GET",packageName,true);xhr.responseType="arraybuffer";xhr.onprogress=function(event){var url=packageName;var size=packageSize;if(event.total)size=event.total;if(event.loaded){if(!xhr.addedTotal){xhr.addedTotal=true;if(!Module.dataFileDownloads)Module.dataFileDownloads={};Module.dataFileDownloads[url]={loaded:event.loaded,total:size}}else{Module.dataFileDownloads[url].loaded=event.loaded}var total=0;var loaded=0;var num=0;for(var download in Module.dataFileDownloads){var data=Module.dataFileDownloads[download];total+=data.total;loaded+=data.loaded;num++}total=Math.ceil(total*Module.expectedDataFileDownloads/num);if(Module["setStatus"])Module["setStatus"]("Downloading data... ("+loaded+"/"+total+")")}else if(!Module.dataFileDownloads){if(Module["setStatus"])Module["setStatus"]("Downloading data...")}};xhr.onerror=function(event){throw new Error("NetworkError for: "+packageName)};xhr.onload=function(event){if(xhr.status==200||xhr.status==304||xhr.status==206||xhr.status==0&&xhr.response){var packageData=xhr.response;callback(packageData)}else{throw new Error(xhr.statusText+" : "+xhr.responseURL)}};xhr.send(null)}function handleError(error){console.error("package error:",error)}var fetchedCallback=null;var fetched=Module["getPreloadedPackage"]?Module["getPreloadedPackage"](REMOTE_PACKAGE_NAME,REMOTE_PACKAGE_SIZE):null;if(!fetched)fetchRemotePackage(REMOTE_PACKAGE_NAME,REMOTE_PACKAGE_SIZE,function(data){if(fetchedCallback){fetchedCallback(data);fetchedCallback=null}else{fetched=data}},handleError);function runWithFS(){function assert(check,msg){if(!check)throw msg+(new Error).stack}Module["FS_createPath"]("/","bin",true,true);Module["FS_createPath"]("/","lib",true,true);Module["FS_createPath"]("/lib","python3.7",true,true);Module["FS_createPath"]("/lib/python3.7","site-packages",true,true);Module["FS_createPath"]("/lib/python3.7/site-packages","space_tracer-4.0.1-py3.7.egg-info",true,true);Module["FS_createPath"]("/lib/python3.7/site-packages","space_tracer",true,true);function DataRequest(start,end,audio){this.start=start;this.end=end;this.audio=audio}DataRequest.prototype={requests:{},open:function(mode,name){this.name=name;this.requests[name]=this;Module["addRunDependency"]("fp "+this.name)},send:function(){},onload:function(){var byteArray=this.byteArray.subarray(this.start,this.end);this.finish(byteArray)},finish:function(byteArray){var that=this;Module["FS_createPreloadedFile"](this.name,null,byteArray,true,true,function(){Module["removeRunDependency"]("fp "+that.name)},function(){if(that.audio){Module["removeRunDependency"]("fp "+that.name)}else{err("Preloading file "+that.name+" failed")}},false,true);this.requests[this.name]=null}};function processPackageData(arrayBuffer){Module.finishedDataFileDownloads++;assert(arrayBuffer,"Loading data file failed.");assert(arrayBuffer instanceof ArrayBuffer,"bad input to processPackageData");var byteArray=new Uint8Array(arrayBuffer);var curr;var compressedData={data:null,cachedOffset:60297,cachedIndexes:[-1,-1],cachedChunks:[null,null],offsets:[0,1224,2260,3549,4281,5297,6366,7517,8493,9304,10359,11258,12203,13482,14570,15549,16343,17194,18067,18929,19829,20826,21762,22675,23687,24738,25795,27148,28234,29275,30351,31426,32507,33459,34424,35277,36394,37412,38475,39602,40769,41680,42595,43522,44455,45368,46172,47048,47953,48861,49997,51246,52372,53320,54171,55309,56483,57427,58437,59477],sizes:[1224,1036,1289,732,1016,1069,1151,976,811,1055,899,945,1279,1088,979,794,851,873,862,900,997,936,913,1012,1051,1057,1353,1086,1041,1076,1075,1081,952,965,853,1117,1018,1063,1127,1167,911,915,927,933,913,804,876,905,908,1136,1249,1126,948,851,1138,1174,944,1010,1040,820],successes:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]};compressedData.data=byteArray;assert(typeof Module.LZ4==="object","LZ4 not present - was your app build with  -s LZ4=1  ?");Module.LZ4.loadPackage({metadata:metadata,compressedData:compressedData});Module["removeRunDependency"]("datafile_space-tracer.data")}Module["addRunDependency"]("datafile_space-tracer.data");if(!Module.preloadResults)Module.preloadResults={};Module.preloadResults[PACKAGE_NAME]={fromCache:false};if(fetched){processPackageData(fetched);fetched=null}else{fetchedCallback=processPackageData}}if(Module["calledRun"]){runWithFS()}else{if(!Module["preRun"])Module["preRun"]=[];Module["preRun"].push(runWithFS)}};loadPackage({files:[{filename:"/bin/space_tracer",start:0,end:432,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer-4.0.1-py3.7.egg-info/entry_points.txt",start:432,end:484,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer-4.0.1-py3.7.egg-info/dependency_links.txt",start:484,end:485,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer-4.0.1-py3.7.egg-info/SOURCES.txt",start:485,end:1185,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer-4.0.1-py3.7.egg-info/PKG-INFO",start:1185,end:4697,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer-4.0.1-py3.7.egg-info/top_level.txt",start:4697,end:4710,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/main.py",start:4710,end:24705,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/code_tracer.py",start:24705,end:54214,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/about.py",start:54214,end:54606,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/__init__.py",start:54606,end:54935,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/report_builder.py",start:54935,end:70534,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/canvas.py",start:70534,end:71632,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/mock_turtle.py",start:71632,end:103070,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/__main__.py",start:103070,end:103163,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/module_importers.py",start:103163,end:120749,audio:0},{filename:"/lib/python3.7/site-packages/space_tracer/traced_finder.py",start:120749,end:122239,audio:0}],remote_package_size:64393,package_uuid:"3fe6eea7-fa27-4aba-baf8-fe8c3669c916"})})();