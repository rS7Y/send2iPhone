-- send2iPhone AppleScript
-- Sends an image file as an iMessage attachment to a phone number.
-- Usage: osascript send-image.applescript "+919021639892" "/path/to/image.png"

on run argv
    set recipientPhone to item 1 of argv
    set imagePath to item 2 of argv
    set imageFile to POSIX file imagePath as alias

    tell application "Messages"
        -- Find the iMessage service
        set iMessageService to 1st account whose service type = iMessage

        -- Create a buddy reference for the recipient
        set theBuddy to buddy recipientPhone of iMessageService

        -- Send the image file as attachment
        send imageFile to theBuddy
    end tell

    return "Image sent to " & recipientPhone
end run
