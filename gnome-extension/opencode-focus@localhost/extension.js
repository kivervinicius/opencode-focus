import Gio from 'gi://Gio'

const DBUS_NAME = 'org.opencode.Focus'
const DBUS_PATH = '/org/opencode/Focus'
const DBUS_IFACE = `
<node>
  <interface name="org.opencode.Focus">
    <method name="GetActiveWindowID">
      <arg type="s" direction="out"/>
    </method>
    <method name="ActivateWindow">
      <arg type="s" direction="in"/>
    </method>
  </interface>
</node>`

export default class OpenCodeFocusExtension {
  enable() {
    this._dbus = Gio.DBusExportedObject.wrapJSObject(DBUS_IFACE, this)
    this._dbus.export(Gio.DBus.session, DBUS_PATH)
    this._ownerId = Gio.DBus.session.own_name(DBUS_NAME, Gio.BusNameOwnerFlags.NONE, null, null)
  }

  disable() {
    if (this._dbus) {
      this._dbus.unexport()
      this._dbus = null
    }
    if (this._ownerId) {
      Gio.DBus.session.unown_name(this._ownerId)
      this._ownerId = 0
    }
  }

  GetActiveWindowID() {
    const win = global.display.focus_window
    return win ? String(win.get_id()) : ''
  }

  ActivateWindow(id) {
    if (typeof id !== 'string') return
    const target = Number(id)
    if (!Number.isFinite(target)) return
    for (const actor of global.get_window_actors()) {
      const win = actor.meta_window
      if (win && win.get_id() === target) {
        global.display.activate_window(win, global.get_current_time())
        return
      }
    }
  }
}
