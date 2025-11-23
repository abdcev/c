from fastapi import FastAPI, Response
import uvicorn
from curl_cffi import requests

app = FastAPI()

@app.get("/yt.php")
def get_stream(v: str = None, c: str = None):
    if not v and not c:
        return Response("Missing parameters", status_code=400)

    # 1) video id belirle
    watch_url = ""
    if v:
        watch_url = f"https://www.youtube.com/watch?v={v}"
    else:
        live_html = requests.get(
            f"https://www.youtube.com/channel/{c}/live",
            impersonate="chrome120"
        ).text

        import re
        m = re.search(r'"videoId":"([^"]+)"', live_html)
        if not m:
            return Response("NoLiveStream", status_code=404)

        vid = m.group(1)
        watch_url = f"https://www.youtube.com/watch?v={vid}"

    # 2) watch HTML içinden m3u8 URL al
    html = requests.get(watch_url, impersonate="chrome120").text
    import re

    m3 = re.search(r'"hlsManifestUrl":"(https:[^"]+?\\.m3u8[^"]*)"', html)
    if not m3:
        return Response("NoLiveStream", status_code=404)

    manifest = m3.group(1).replace("\\u0026", "&")

    # 3) m3u8 indir
    m3u8 = requests.get(manifest, impersonate="chrome120").text

    return Response(
        content=m3u8,
        media_type="application/vnd.apple.mpegurl"
    )


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=10000)
