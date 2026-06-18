pipeline {

agent any

environment {
    IMAGE_NAME = "rajeshkosta/app"
    TAG = "${BUILD_NUMBER}"
    APP_LANG = ""
}

stages {

    stage('Checkout') {
        steps {
            checkout scm
        }
    }

    stage('Gitleaks Scan') {
        steps {
            sh 'gitleaks detect --source . --verbose'
        }
    }

    stage('Trivy Filesystem Scan') {
        steps {
            sh 'trivy fs . --severity HIGH,CRITICAL'
        }
    }

    stage('Detect Language') {
        steps {
            script {

                if (fileExists('Application-Code/backend/pom.xml')) {
                    env.APP_LANG = "java"
                }

                else if (fileExists('Application-Code/backend/package.json')) {
                    env.APP_LANG = "nodejs"
                }

                else if (fileExists('Application-Code/backend/requirements.txt')) {
                    env.APP_LANG = "python"
                }

                else if (fileExists('Application-Code/backend/go.mod')) {
                    env.APP_LANG = "golang"
                }

                else {
                    error("Unsupported Language")
                }

                echo "Detected Language: ${APP_LANG}"
            }
        }
    }

    stage('Build') {
        steps {
            script {

                switch(APP_LANG) {

                    case "java":

                        dir('Application-Code/backend') {
                            sh 'mvn clean package'
                        }
                        break

                    case "nodejs":

                        dir('Application-Code/backend') {
                            sh '''
                            npm install
                            npm run build
                            '''
                        }
                        break

                    case "python":

                        dir('Application-Code/backend') {
                            sh '''
                            python3 -m venv venv
                            . venv/bin/activate
                            pip install -r requirements.txt
                            '''
                        }
                        break

                    case "golang":

                        dir('Application-Code/backend') {
                            sh 'go build ./...'
                        }
                        break
                }
            }
        }
    }

    stage('Frontend Build') {
        when {
            expression {
                fileExists('Application-Code/frontend/package.json')
            }
        }

        steps {
            dir('Application-Code/frontend') {
                sh '''
                npm install
                npm run build
                '''
            }
        }
    }

    stage('Unit Tests') {
        steps {

            script {

                switch(APP_LANG) {

                    case "java":
                        dir('Application-Code/backend') {
                            sh 'mvn test'
                        }
                        break

                    case "nodejs":
                        dir('Application-Code/backend') {
                            sh 'npm test || true'
                        }
                        break

                    case "python":
                        dir('Application-Code/backend') {
                            sh '''
                            . venv/bin/activate
                            pytest || true
                            '''
                        }
                        break

                    case "golang":
                        dir('Application-Code/backend') {
                            sh 'go test ./...'
                        }
                        break
                }
            }
        }
    }

    stage('SonarQube Scan') {
        when {
            expression {
                APP_LANG == "java"
            }
        }

        steps {
            withSonarQubeEnv('sonar') {

                dir('Application-Code/backend') {

                    sh '''
                    mvn sonar:sonar \
                    -Dsonar.projectKey=backend
                    '''
                }
            }
        }
    }

    stage('Build Docker Image') {

        steps {

            sh """
            docker build \
            -t ${IMAGE_NAME}:${TAG} .
            """
        }
    }

    stage('Trivy Image Scan') {

        steps {

            sh """
            trivy image ${IMAGE_NAME}:${TAG}
            """
        }
    }

    stage('Push Docker Image') {

        steps {

            withCredentials([
                usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )
            ]) {

                sh '''
                echo $DOCKER_PASS | docker login \
                -u $DOCKER_USER --password-stdin
                '''

                sh """
                docker push ${IMAGE_NAME}:${TAG}
                """
            }
        }
    }

    stage('Archive Artifact') {

        steps {

            archiveArtifacts(
                artifacts: '**/target/*.jar, **/dist/**',
                fingerprint: true
            )
        }
    }
}

post {

    always {
        cleanWs()
    }

    success {
        echo 'Pipeline Success'
    }

    failure {
        echo 'Pipeline Failed'
    }
}

}
