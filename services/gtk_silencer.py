# services/gtk_silencer.py
from ctypes import (
    CFUNCTYPE,
    POINTER,
    Structure,
    c_char_p,
    c_int,
    c_size_t,
    c_ssize_t,
    c_void_p,
    cast,
    CDLL,
)


def suppress_glib_warnings():
    try:
        # Carrega a DLL do GLib (padrão no Windows com GTK3 instalado)
        glib = CDLL("libglib-2.0-0.dll")
    except OSError:
        # Se não achar a DLL, apenas ignora
        return

    class GLogField(Structure):  # noqa: N801
        _fields_ = [("key", c_char_p), ("value", c_void_p), ("length", c_ssize_t)]

    g_log_writer_handled = 1
    writer_func_type = CFUNCTYPE(c_int, c_int, POINTER(GLogField), c_size_t, c_void_p)

    glib.g_log_set_writer_func.argtypes = [writer_func_type, c_void_p, c_void_p]
    glib.g_log_set_writer_func.restype = None

    @writer_func_type
    def writer(_level, fields, n_fields, _user_data):
        for i in range(n_fields):
            f = fields[i]
            if f.key == b"GLIB_DOMAIN":
                if cast(f.value, c_char_p).value == b"GLib-GIO":
                    return g_log_writer_handled
        return 0  # G_LOG_WRITER_UNHANDLED

    glib.g_log_set_writer_func(writer, None, None)