#!/bin/sh
set -eu
source_dir=$(CDPATH= cd -- "$(dirname -- "$(readlink -f -- "$0")")" && pwd)
install_home=${DAILYXP_INSTALL_HOME:-"$HOME"}
app_dir="$install_home/.local/opt/dailyxp"
bin_dir="$install_home/.local/bin"
applications="$install_home/.local/share/applications"
stage="$app_dir.staging.$$"
backup="$app_dir.backup.$(date +%Y%m%dT%H%M%S)"
test -x "$source_dir/dailyxp" || { echo 'Run the installer from the extracted DailyXP Linux archive.' >&2; exit 1; }
command -v flock >/dev/null || { echo 'Install util-linux, which supplies flock, then rerun this installer.' >&2; exit 1; }
mkdir -p "$(dirname -- "$app_dir")" "$bin_dir" "$applications"
cleanup() {
  if test -d "$stage"; then rm -rf -- "$stage"; fi
  if ! test -e "$app_dir" && test -d "$backup"; then mv -- "$backup" "$app_dir"; fi
}
trap cleanup EXIT HUP INT TERM
mkdir "$stage"
cp -a "$source_dir/." "$stage/"
if test -e "$app_dir"; then mv -- "$app_dir" "$backup"; fi
mv -- "$stage" "$app_dir"
cat > "$app_dir/dailyxpctl" <<'CONTROLLER'
#!/bin/sh
root=$(CDPATH= cd -- "$(dirname -- "$(readlink -f -- "$0")")" && pwd)
ELECTRON_RUN_AS_NODE=1 exec "$root/dailyxp" "$root/resources/app.asar/apps/desktop/core/cli.cjs" "$@"
CONTROLLER
chmod +x "$app_dir/dailyxpctl"
ln -sfn "$app_dir/dailyxp" "$bin_dir/dailyxp"
ln -sfn "$app_dir/dailyxpctl" "$bin_dir/dailyxpctl"
cat > "$applications/dailyxp.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=DailyXP
Comment=Focused work and permanent progress
Exec="$bin_dir/dailyxp"
Icon=$app_dir/resources/app.asar.unpacked/apps/desktop/renderer/icon.png
Terminal=false
Categories=Utility;
StartupWMClass=dailyxp
DESKTOP
if command -v update-desktop-database >/dev/null; then update-desktop-database "$applications"; fi
printf 'Installed %s\nPrevious installation backup, if present: %s\n' "$app_dir" "$backup"
