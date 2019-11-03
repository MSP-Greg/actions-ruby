$dash = "$([char]0x2015)"

$med = $dash * 50

write-host ''
write-host "$med openssl"; where.exe openssl.exe
write-host "$med make"   ; where.exe make.exe
write-host "$med gcc"    ; where.exe gcc.exe
write-host "$med ruby"   ; where.exe ruby.exe

write-host "`n$med OpenSSL 1.1.x dlls"
$eay = $(where.exe libcrypto-1_1-x64.dll)
$ssl = $(where.exe libssl-1_1-x64.dll)
$all = ($eay + "`n" + $ssl).split("`n") | Sort
write-host $($all -join "`n").trim()

write-host "`n$med OpenSSL 1.0.x dlls"
$eay = $(where.exe libeay32.dll)
$ssl = $(where.exe ssleay32.dll)
$all = ($eay + "`n" + $ssl).split("`n") | Sort
write-host $($all -join "`n").trim()

