-- send2iPhone AppleScript
-- Sends an image file as an iMessage attachment to a phone number.
-- Usage: osascript send-image.applescript "+919021639892" "/path/to/image.png"

on run argv
    set recipientPhone to item 1 of argv
    set imagePath to item 2 of argv
    set imageFile to POSIX file imagePath as alias

    -- Wake up Messages.app and wait for it to be fully running
    tell application "Messages"
        activate
    end tell

    -- Give Messages time to launch and connect to iMessage servers
    -- This is the key fix: without this, the first send always fails
    -- because the iMessage service hasn't established its connection yet
    set maxWaitSeconds to 10
    set isReady to false
    repeat maxWaitSeconds times
        try
            tell application "Messages"
                set iMessageService to 1st account whose service type = iMessage
                -- If we got here without error, the service is available
                set isReady to true
            end tell
        end try
        if isReady then exit repeat
        delay 1
    end repeat

    if not isReady then
        error "Messages.app iMessage service did not become available after " & maxWaitSeconds & " seconds"
    end if

    -- Extra settle time on first connection for the service to fully authenticate
    delay 1

    -- Retry logic: attempt up to 3 times in case of transient failures
    set maxRetries to 3
    set lastError to ""
    repeat with attempt from 1 to maxRetries
        try
            tell application "Messages"
                set iMessageService to 1st account whose service type = iMessage
                set theBuddy to buddy recipientPhone of iMessageService
                send imageFile to theBuddy
            end tell
            return "Image sent to " & recipientPhone
        on error errMsg
            set lastError to errMsg
            if attempt < maxRetries then
                delay 2
            end if
        end try
    end repeat

    error "Failed after " & maxRetries & " attempts. Last error: " & lastError
end run
