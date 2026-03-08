package manga_providers

import util "kamehouse/internal/util/proxies"

func GetImageByProxy(url string, headers map[string]string) ([]byte, error) {
	ip := &util.ImageProxy{}
	return ip.GetImage(url, headers)
}
