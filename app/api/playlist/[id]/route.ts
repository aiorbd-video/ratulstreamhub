// app/api/playlist/[id]/route.ts

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

    const userAgent =
      req.headers
      .get("user-agent")
      ?.toLowerCase() || "";

    // 🚫 Browser block
    const isBrowser =

      userAgent.includes('mozilla') &&

      (
        userAgent.includes('chrome') ||
        userAgent.includes('safari') ||
        userAgent.includes('firefox') ||
        userAgent.includes('edge')
      ) &&

      !userAgent.includes('tv') &&
      !userAgent.includes('smarters') &&
      !userAgent.includes('iptv');

    if (isBrowser) {

      return new Response(
        "🚫 Access Denied! Open inside IPTV Player only.",
        {
          status:403,
          headers:{
            "Content-Type":"text/plain",
            "Access-Control-Allow-Origin":"*"
          }
        }
      );

    }

    const client =
      await clientPromise;

    const db =
      client.db(
        "all_in_one_reborn_db"
      );

    let userId;

    try {

      userId =
      new ObjectId(
        params.id
      );

    } catch {

      return new Response(
`#EXTM3U
#EXTINF:-1,❌ Invalid User
http://error.local`,
{
status:400
}
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
        ) <
        new Date()
      )

    ){

      return new Response(
`#EXTM3U
#EXTINF:-1,🚫 Subscription Expired
http://expired.local`,
{
headers:{
"Content-Type":
"application/vnd.apple.mpegurl",
"Access-Control-Allow-Origin":"*"
}
}
      );

    }

    let m3uContent =
    `#EXTM3U x-tvg-url=""\n`;



    // ========= DATABASE STREAMS =========

    const streams =
    await db
    .collection(
      "posted_streams"
    )
    .find({})
    .toArray();


    streams.forEach(stream=>{

      let rawTitle =

      (
        stream.title || ""
      )

      .replace(
      /tvg-[a-zA-Z0-9\-]+="[^"]*"/g,
      ""
      )

      .replace(
      /(https?:\/\/[^\s]+)/g,
      ""
      )

      .replace(
      /^[,-\s]+/,
      ""
      )

      .trim()

      || "Live TV";


      if(
        stream.stream_url
      ){

        m3uContent +=

`#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}",${rawTitle}
${stream.stream_url.replace(/[\r\n\s]+/g,'').trim()}
`;

      }

    });



    // ========= PREMIUM M3U =========

    const mergedM3uDoc =
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
      Record<string,string>
      ={};


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
        ) continue;



        // EXTINF
        if(
          line.startsWith(
            "#EXTINF"
          )
        ){

          m3uContent +=
          line+"\n";

        }



        // User-Agent
        else if(

          line.startsWith(
'#EXTVLCOPT:http-user-agent='
          )

        ){

          tempHeaders[
            "User-Agent"
          ]=

          line.substring(
'#EXTVLCOPT:http-user-agent='.length
          )
          .trim();

        }



        // Referer + Referrer support
        else if(

          line.startsWith(
'#EXTVLCOPT:http-referer='
          )

          ||

          line.startsWith(
'#EXTVLCOPT:http-referrer='
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



        // JSON HEADER
        else if(

          line.startsWith(
            "#EXTHTTP:"
          )

        ){

          try{

            const jsonStr=

            line.substring(
              9
            );


            const parsed=
            JSON.parse(
              jsonStr
            );


            Object.entries(
              parsed
            )

            .forEach(
            ([k,v])=>{

              const key=

              k
              .toLowerCase();


              if(

                key==="cookie"

              ){

                tempHeaders[
                  "Cookie"
                ]=

                String(v);

              }


              else if(

                key==="referer" ||

                key==="referrer"

              ){

                tempHeaders[
                  "Referer"
                ]=

                String(v);

              }


              else if(

                key==="origin"

              ){

                tempHeaders[
                  "Origin"
                ]=

                String(v);

              }


              else if(

                key==="user-agent" ||

                key==="useragent"

              ){

                tempHeaders[
                  "User-Agent"
                ]=

                String(v);

              }

            });

          }

          catch(e){

            console.log(
              "JSON parse error:",
              e
            );

          }

        }



        // URL
        else if(

          line.startsWith(
            "http://"
          )

          ||

          line.startsWith(
            "https://"
          )

        ){

          let fullUrl=

          line
          .replace(
            /[\r\n\s]+/g,
            ""
          )
          .trim();



          // pipe attach
          if(

            !fullUrl.includes(
              "|"
            )

            &&

            Object.keys(
              tempHeaders
            ).length>0

          ){

            let pipeStr="";


            for(

              const[
                key,
                val
              ]

              of

              Object.entries(
                tempHeaders
              )

            ){

              pipeStr +=

`${pipeStr ? '&':'|'}${key}=${encodeURIComponent(String(val))}`;

            }


            fullUrl +=
            pipeStr;

          }



          m3uContent +=
          fullUrl+"\n";


          // reset
          tempHeaders={};

        }



        // অন্য tags রেখে দাও
        else{

          if(

            !line.startsWith(
              "#EXTVLCOPT"
            )

            &&

            !line.startsWith(
              "#EXTHTTP"
            )

          ){

            m3uContent +=
            line+"\n";

          }

        }

      }

    }



    return new Response(
      m3uContent,
      {

        status:200,

        headers:{

"Content-Type":"application/vnd.apple.mpegurl",

"Content-Disposition":
`inline; filename="Reborn_Playlist_${user.phone}.m3u"`,

"Access-Control-Allow-Origin":"*"

        }

      }
    );


  }

  catch(error){

console.log(error);

return new Response(
`#EXTM3U
#EXTINF:-1,❌ Server Error
http://error.local`,
{
status:500
}
);

  }

}
