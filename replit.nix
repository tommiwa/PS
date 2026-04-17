{pkgs}: {
  deps = [
    pkgs.gdk-pixbuf
    pkgs.cairo
    pkgs.pango
    pkgs.gtk3
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.alsa-lib
    pkgs.dbus
    pkgs.libxkbcommon
    pkgs.xorg.libxcb
    pkgs.expat
    pkgs.nss
    pkgs.glib
  ];
}
