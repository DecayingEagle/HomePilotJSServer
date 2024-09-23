# HomePilotJSServer

## Prerequisites

Before running the project, ensure you have the following installed on your Raspberry Pi:

- Node.js (v14.x or later)
- npm (v6.x or later)
- `ssh-askpass` (for password prompts)

You can install Node.js and npm using the following commands:

```shell
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Install `ssh-askpass`:

```shell
sudo apt-get install -y ssh-askpass
```

## Installation

1. **Clone the repository**:

   ```shell
   git clone <repository_url>
   cd HomePilotJSServer
   ```

2. **Install npm dependencies**:

   ```shell
   npm install
   ```

## Running the Project

1. **Make the `run.sh` script executable**:

   ```shell
   chmod +x run.sh
   ```

2. **Run the script**:

   ```shell
   ./run.sh
   ```

## Troubleshooting

- Ensure the `askpass.sh` script is executable:

  ```shell
  chmod +x askpass.sh
  ```

- If you encounter permission issues, make sure you are running the script with the necessary permissions.

## Notes

- The `run.sh` script must be run as root to set the permissions for the detected serial port.
- The script will prompt for your password using `zenity` if it needs to run commands with `sudo`.

## License

This project is licensed under the MIT License.
