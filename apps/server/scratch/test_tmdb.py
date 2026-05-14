import http.client
import json

conn = http.client.HTTPSConnection("api.themoviedb.org")

headers = {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIwNTg0ZDQ0MzdiZTRkMTMxNzQwODViYzliNDQzNTk4NSIsIm5iZiI6MTc2Mzg4ODUzOC43NzEwMDAxLCJzdWIiOiI2OTIyY2Q5YTNjYTJhNzM3Yzc5NTg4YmIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.4OtRAEqcJhg9w7FoEgCbl_lkzAA8_gQHMTQ49eUkjgg',
    'accept': 'application/json'
}

# Test movie ID 126963 (Battle of Gods TMDB ID)
conn.request("GET", "/3/movie/126963?language=es-ES", headers=headers)

res = conn.getresponse()
data = res.read()

print(f"Status: {res.status}")
print(f"Response: {data.decode('utf-8')}")
