/* Synthetic-only workaround for an executor exposing only UID 0.
 * Changes libc UID/ownership observations, NOT PostgreSQL roles/RLS/locking.
 * Never proves OS isolation; never install globally or use with production.
 */
#define _GNU_SOURCE
#include <unistd.h>
#include <sys/stat.h>
#include <dlfcn.h>
uid_t getuid(void) { return 1; }
uid_t geteuid(void) { return 1; }
#define WRAP_STAT(fn, args, call) \
int fn args { static int (*real_fn) args; if (!real_fn) real_fn=dlsym(RTLD_NEXT,#fn); int r=real_fn call; if (!r && buf->st_uid==0) buf->st_uid=1; return r; }
WRAP_STAT(stat,(const char *path,struct stat *buf),(path,buf))
WRAP_STAT(lstat,(const char *path,struct stat *buf),(path,buf))
WRAP_STAT(fstat,(int fd,struct stat *buf),(fd,buf))
WRAP_STAT(fstatat,(int fd,const char *path,struct stat *buf,int flags),(fd,path,buf,flags))
WRAP_STAT(__xstat,(int ver,const char *path,struct stat *buf),(ver,path,buf))
WRAP_STAT(__lxstat,(int ver,const char *path,struct stat *buf),(ver,path,buf))
WRAP_STAT(__fxstat,(int ver,int fd,struct stat *buf),(ver,fd,buf))
