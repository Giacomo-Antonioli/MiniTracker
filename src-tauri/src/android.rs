//! Android only (#168 Phase 3): the phone drops mDNS (multicast) packets unless the app holds a
//! WifiManager.MulticastLock. MainActivity.kt has the two small methods called here; on other
//! platforms this does nothing.

#[cfg(target_os = "android")]
pub fn multicast_lock(on: bool) {
    let run = || -> Result<(), jni::errors::Error> {
        let ctx = ndk_context::android_context();
        // SAFETY: the VM and activity pointers come from the Android runtime and live as long as the app.
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }?;
        let mut env = vm.attach_current_thread()?;
        let activity = unsafe { jni::objects::JObject::from_raw(ctx.context().cast()) };
        let method = if on { "acquireMulticastLock" } else { "releaseMulticastLock" };
        env.call_method(&activity, method, "()V", &[])?;
        Ok(())
    };
    if let Err(e) = run() {
        log::warn!("multicast lock: {e}");
    }
}

#[cfg(not(target_os = "android"))]
pub fn multicast_lock(_on: bool) {}
