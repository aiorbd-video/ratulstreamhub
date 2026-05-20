import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    }
  });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {

try {

const client = await clientPromise;

const db =
client.db(
"all_in_one_reborn_db"
);

let userId;

try{

userId =
new ObjectId(
params.id
);

}catch{

return new Response(
`#EXTM3U
#EXTINF:-1,Invalid User
http://error.local`,
{status:400}
);

}


const user =
await db
.collection(
"web_users"
)
.findOne({
_id:userId
});


if(
!user ||
!user.isPremium ||
(
user.premiumExpiry &&
new Date(
user.premiumExpiry
)<new Date()
)
){

return new Response(
`#EXTM3U
#EXTINF:-1,Subscription Expired
http://expired.local`,
{
headers:{
"Content-Type":
"application/vnd.apple.mpegurl"
}
}
);

}


let m3uContent=
`#EXTM3U\n`;


// TEST stream
m3uContent +=
`#EXTINF:-1 group-title="TEST",TEST CHANNEL
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
`;



const streams=
await db
.collection(
"posted_streams"
)
.find({})
.toArray();


streams.forEach(stream=>{

if(
stream.stream_url
){

let title=

(stream.title||"Live TV")

.replace(
/tvg-[^"]+="[^"]*"/g,
""
)

.trim();


m3uContent +=

`#EXTINF:-1 tvg-logo="${stream.logo||''}" group-title="${stream.group||'Live'}",${title}
${stream.stream_url.trim()}
`;

}

});



const mergedM3uDoc=

await db
.collection(
"system_settings"
)
.findOne({

key:
"merged_premium_m3u"

});


if(
mergedM3uDoc?.content
){

const lines=

mergedM3uDoc
.content
.split(/\r?\n/);


let tempHeaders:
Record<
string,
string
>={};


for(
let i=0;
i<lines.length;
i++
){

let line=
lines[i]
.trim();

if(
!line
)
continue;



if(
line.startsWith(
"#EXTINF"
)
){

m3uContent +=
line+"\n";

}



else if(

line.startsWith(
"#EXTVLCOPT:http-user-agent="
)

){

tempHeaders[
"User-Agent"
]=

line.substring(
33
).trim();

}



else if(

line.startsWith(
"#EXTVLCOPT:http-referer="
)

||

line.startsWith(
"#EXTVLCOPT:http-referrer="
)

){

tempHeaders[
"Referer"
]=

line
.split("=")
.slice(1)
.join("=")
.trim();

}



else if(

line.startsWith(
"#EXTHTTP:"
)

){

try{

const parsed=

JSON.parse(
line.substring(
9
)
);



if(
parsed.cookie ||
parsed.Cookie
){

tempHeaders[
"Cookie"
]=

parsed.cookie||
parsed.Cookie;

}


if(
parsed.origin ||
parsed.Origin
){

tempHeaders[
"Origin"
]=

parsed.origin||
parsed.Origin;

}



if(

parsed.referer ||

parsed.referrer ||

parsed.Referer

){

tempHeaders[
"Referer"
]=

parsed.referer||

parsed.referrer||

parsed.Referer;

}



}catch(e){}

}



else if(

line.startsWith(
"http"
)

){

let fullUrl=
line.trim();


// important
if(

!tempHeaders[
"User-Agent"
]

){

tempHeaders[
"User-Agent"
]=
"Mozilla/5.0";

}



if(

Object.keys(
tempHeaders
)
.length>0

&&

!fullUrl.includes(
"|"
)

){

let headerStr=

Object.entries(
tempHeaders
)

.map(
([k,v])=>

`${k}=${v}`

)

.join("&");


fullUrl +=

"|"+headerStr;

}



m3uContent +=
fullUrl+"\n";


tempHeaders={};

}

}

}



return new Response(

m3uContent,

{

status:200,

headers:{

"Content-Type":
"application/vnd.apple.mpegurl",

"Content-Disposition":
`inline; filename="playlist_${user.phone}.m3u"`,

"Access-Control-Allow-Origin":"*"

}

}

);

}

catch(e){

console.log(e);

return new Response(
`#EXTM3U
#EXTINF:-1,Server Error
http://error.local`,
{
status:500
}
);

}

}
